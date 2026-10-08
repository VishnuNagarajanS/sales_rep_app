using System.Security.Cryptography;
using System.Text;
using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.Irm;
using backend.Models.Entities;
using backend.Models.Enums;
using backend.Repositories.Interfaces;
using backend.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Implementations;

public class KycService : IKycService
{
    private readonly IKycRepository _kycRepo;
    private readonly IInvestorRepository _investorRepo;
    private readonly IEmailService _emailService;
    private readonly IOtpService _otpService;
    private readonly ApplicationDbContext _db;
    private readonly ILogger<KycService> _logger;
    private readonly IIrmOtherService _otherService;
    private readonly IConfiguration _config;

    public KycService(
        IKycRepository kycRepo,
        IInvestorRepository investorRepo,
        IEmailService emailService,
        IOtpService otpService,
        ApplicationDbContext db,
        ILogger<KycService> logger,
        IConfiguration config,
        IIrmOtherService? otherService = null)
    {
        _kycRepo = kycRepo;
        _investorRepo = investorRepo;
        _emailService = emailService;
        _otpService = otpService;
        _db = db;
        _logger = logger;
        _config = config;
        _otherService = otherService ?? new IrmOtherService(db);
    }

    public static bool IsValidPan(string? pan) =>
        !string.IsNullOrWhiteSpace(pan) && System.Text.RegularExpressions.Regex.IsMatch(pan.Trim().ToUpperInvariant(), "^[A-Z]{5}[0-9]{4}[A-Z]{1}$");

    public static bool IsValidAadhaar(string? aadhaar)
    {
        if (string.IsNullOrWhiteSpace(aadhaar)) return false;
        var digits = new string(aadhaar.Where(char.IsDigit).ToArray());
        return digits.Length == 12;
    }

    public static bool IsValidIfsc(string? ifsc) =>
        !string.IsNullOrWhiteSpace(ifsc) && System.Text.RegularExpressions.Regex.IsMatch(ifsc.Trim().ToUpperInvariant(), "^[A-Z]{4}0[A-Z0-9]{6}$");

    private static string? MaskPan(string? pan)
    {
        if (string.IsNullOrWhiteSpace(pan) || pan.Length < 10) return null;
        return $"{pan[..2]}••••••{pan[^2..]}";
    }

    private static string? MaskAadhaar(string? aadhaar)
    {
        if (string.IsNullOrWhiteSpace(aadhaar)) return null;
        var clean = new string(aadhaar.Where(char.IsDigit).ToArray());
        if (clean.Length < 4) return null;
        return $"•••• •••• {clean[^4..]}";
    }

    private static string? MaskAccount(string? acc)
    {
        if (string.IsNullOrWhiteSpace(acc) || acc.Length < 4) return null;
        return $"••••••••{acc[^4..]}";
    }

    public async Task<ApiResponse<KycDto>> GetByInvestorIdAsync(int investorId, int companyId, CancellationToken ct = default)
    {
        var kyc = await _kycRepo.GetByInvestorIdAsync(investorId, companyId, ct);
        if (kyc == null)
            return ApiResponse<KycDto>.ErrorResponse("KYC record not found for this investor");

        return ApiResponse<KycDto>.SuccessResponse(MapToDto(kyc));
    }

    public async Task<ApiResponse<KycDto>> GetByIdAsync(int id, int companyId, CancellationToken ct = default)
    {
        var kyc = await _kycRepo.GetByIdAsync(id, companyId, ct);
        if (kyc == null)
            return ApiResponse<KycDto>.ErrorResponse("KYC record not found");

        return ApiResponse<KycDto>.SuccessResponse(MapToDto(kyc));
    }

    public static string HashToken(string rawToken)
    {
        if (string.IsNullOrWhiteSpace(rawToken)) return string.Empty;
        using var sha256 = SHA256.Create();
        return Convert.ToHexString(sha256.ComputeHash(Encoding.UTF8.GetBytes(rawToken.Trim()))).ToLowerInvariant();
    }

    public async Task<ApiResponse<SendKycLinkResponseDto>> SendKycLinkAsync(int companyId, int irmId, SendKycLinkDto dto, CancellationToken ct = default)
    {
        Investor? investor = null;
        if (dto.InvestorId.HasValue && dto.InvestorId.Value > 0)
        {
            investor = await _investorRepo.GetByIdAsync(dto.InvestorId.Value, companyId, ct);
        }

        var investorName = investor?.Name ?? dto.CustomerName ?? "Valued Investor";
        var recipientEmail = dto.Email ?? investor?.Email ?? string.Empty;
        var recipientPhone = !string.IsNullOrWhiteSpace(dto.Phone) ? dto.Phone : (investor?.Phone ?? string.Empty);

        if (investor == null && !string.IsNullOrWhiteSpace(recipientEmail))
        {
            var allInvestors = await _investorRepo.GetAllAsync(companyId, null, null, null, ct);
            investor = allInvestors.FirstOrDefault(i => string.Equals(i.Email, recipientEmail, StringComparison.OrdinalIgnoreCase) ||
                                                       (!string.IsNullOrWhiteSpace(recipientPhone) && i.Phone == recipientPhone));
        }

        if (investor == null)
        {
            investor = new Investor
            {
                CompanyId = companyId,
                Name = investorName,
                Email = recipientEmail,
                Phone = recipientPhone,
                Status = InvestorStatus.Lead,
                AssignedIrmId = irmId > 0 ? irmId : null,
                CreatedAt = DateTime.UtcNow
            };
            investor = await _investorRepo.CreateAsync(investor, ct);
        }

        var isLinkOnly = string.Equals(dto.Channel, "link", StringComparison.OrdinalIgnoreCase) || 
                         string.Equals(dto.Channel, "generate", StringComparison.OrdinalIgnoreCase);
        var isEmailChannel = string.IsNullOrWhiteSpace(dto.Channel) || dto.Channel.Equals("email", StringComparison.OrdinalIgnoreCase);
        var isWhatsApp = string.Equals(dto.Channel, "whatsapp", StringComparison.OrdinalIgnoreCase);
        var isSms = string.Equals(dto.Channel, "sms", StringComparison.OrdinalIgnoreCase);

        var days = dto.Expiry?.ToLower() switch
        {
            "24h" => 1,
            "48h" => 2,
            "72h" => 3,
            "7d" => 7,
            _ => 2
        };
        var expiresAt = DateTime.UtcNow.AddDays(days);

        InvestorKyc? existing = null;
        if (investor != null)
        {
            existing = await _kycRepo.GetByInvestorIdAsync(investor.Id, companyId, ct);
        }

        if (existing == null && !string.IsNullOrWhiteSpace(recipientEmail))
        {
            existing = await _kycRepo.GetByEmailAsync(recipientEmail, companyId, ct);
        }

        if (existing == null && !string.IsNullOrWhiteSpace(recipientPhone))
        {
            var phoneDigits = new string(recipientPhone.Where(char.IsDigit).ToArray());
            if (phoneDigits.Length >= 10)
            {
                var last10 = phoneDigits[^10..];
                existing = await _kycRepo.GetByPhoneLast10Async(last10, companyId, ct);
            }
        }

        string rawToken;
        string tokenHash;

        // Check if existing record already has an active, valid, non-expired token
        bool hasActiveToken = existing != null 
            && !string.IsNullOrWhiteSpace(existing.KycLinkToken) 
            && !existing.IsRevoked 
            && existing.KycLinkExpiresAt.HasValue 
            && existing.KycLinkExpiresAt.Value > DateTime.UtcNow.AddMinutes(5);

        if (isLinkOnly && hasActiveToken && !dto.ForceNewToken)
        {
            // Reuse active token so viewing or copying the link does not invalidate already delivered customer links
            rawToken = existing!.KycLinkToken!;
            tokenHash = existing.KycTokenHash ?? HashToken(rawToken);
            expiresAt = existing.KycLinkExpiresAt!.Value;
        }
        else
        {
            // Cryptographically secure token (32 random bytes -> 64 hex characters)
            rawToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
            tokenHash = HashToken(rawToken);

            // Invalidate pending OTPs for the old token if resending
            if (existing != null && !string.IsNullOrWhiteSpace(existing.KycLinkToken))
            {
                await _otpService.InvalidateOtpAsync(existing.KycLinkToken, existing.Email, ct);
            }
        }

        var defaultBaseUrl = _config["SmtpSettings:ClientBaseUrl"] ?? "http://localhost:5173";
        string baseUrl = defaultBaseUrl;
        if (!string.IsNullOrWhiteSpace(dto.BaseUrl))
        {
            var cleanInput = dto.BaseUrl.TrimEnd('/');
            if (Uri.TryCreate(cleanInput, UriKind.Absolute, out var parsedUri) &&
                (parsedUri.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase) ||
                 parsedUri.Host.EndsWith("ghl.com", StringComparison.OrdinalIgnoreCase) ||
                 parsedUri.Host.EndsWith("nexus.com", StringComparison.OrdinalIgnoreCase) ||
                 (Uri.TryCreate(defaultBaseUrl, UriKind.Absolute, out var defUri) && parsedUri.Host.Equals(defUri.Host, StringComparison.OrdinalIgnoreCase))))
            {
                baseUrl = cleanInput;
            }
        }
        var fullKycLink = $"{baseUrl}/kyc/{rawToken}";

        bool emailSent = false;
        string deliveryStatus = "Generated";

        if (isEmailChannel)
        {
            if (string.IsNullOrWhiteSpace(recipientEmail))
            {
                deliveryStatus = "Email not sent: no email address was found for this investor.";
            }
            else
            {
                emailSent = await _emailService.SendKycVerificationLinkAsync(
                    recipientEmail,
                    investorName,
                    fullKycLink,
                    dto.Expiry ?? "48 Hours",
                    ct);

                deliveryStatus = emailSent 
                    ? $"Email delivered successfully to {recipientEmail} via configured SMTP" 
                    : $"Email could not be sent: {_emailService.LastError ?? "SMTP service delivery failed"}";
            }
        }
        else if (isLinkOnly)
        {
            deliveryStatus = "Secure KYC verification link generated successfully.";
        }
        else if (isWhatsApp)
        {
            deliveryStatus = "WhatsApp delivery unavailable: No WhatsApp Business API provider is configured on the backend server.";
        }
        else if (isSms)
        {
            deliveryStatus = "SMS delivery unavailable: No SMS gateway provider is configured on the backend server.";
        }
        else
        {
            deliveryStatus = $"Message delivery failed: Channel '{dto.Channel}' is not configured.";
        }

        // Persist real KYC record safely based on actual dispatch outcome (never claim fake delivery for unconfigured SMS/WhatsApp)
        if (existing == null)
        {
            existing = new InvestorKyc
            {
                InvestorId = investor?.Id ?? 0,
                CompanyId = companyId,
                IrmId = irmId,
                InvestorName = investorName,
                Phone = recipientPhone,
                Email = recipientEmail,
                Status = emailSent ? KycStatus.LinkSent : KycStatus.Draft,
                KycLinkToken = rawToken,
                KycTokenHash = tokenHash,
                IsRevoked = false,
                KycLinkSent = emailSent,
                KycLinkSentAt = emailSent ? DateTime.UtcNow : null,
                KycLinkExpiresAt = expiresAt,
                CreatedAt = DateTime.UtcNow
            };
            await _kycRepo.CreateAsync(existing, ct);
        }
        else
        {
            existing.KycLinkToken = rawToken;
            existing.KycTokenHash = tokenHash;
            existing.IsRevoked = false;
            existing.RevokedAt = null;
            existing.KycLinkExpiresAt = expiresAt;
            if (!string.IsNullOrWhiteSpace(recipientEmail)) existing.Email = recipientEmail;
            if (!string.IsNullOrWhiteSpace(recipientPhone)) existing.Phone = recipientPhone;
            if (!string.IsNullOrWhiteSpace(investorName)) existing.InvestorName = investorName;

            if (emailSent)
            {
                existing.KycLinkSent = true;
                existing.KycLinkSentAt = DateTime.UtcNow;
                if (existing.Status == KycStatus.Draft || existing.Status == KycStatus.LinkSent)
                    existing.Status = KycStatus.LinkSent;
            }
            else
            {
                // No backend delivery occurred or email failed: do not falsely claim link was dispatched
                existing.KycLinkSent = false;
                if (existing.Status == KycStatus.LinkSent && isEmailChannel)
                    existing.Status = KycStatus.Draft;
            }

            await _kycRepo.UpdateAsync(existing, ct);
        }

        var responseData = new SendKycLinkResponseDto
        {
            Token = rawToken,
            Link = fullKycLink,
            ExpiresAt = expiresAt,
            EmailSent = emailSent,
            DeliveryStatus = deliveryStatus
        };

        if (isEmailChannel && string.IsNullOrWhiteSpace(recipientEmail))
        {
            return ApiResponse<SendKycLinkResponseDto>.FailureResult("No recipient email address was found for this investor.", responseData);
        }

        if (isEmailChannel && !emailSent)
        {
            var errReason = _emailService.LastError ?? "SMTP delivery failed";
            return ApiResponse<SendKycLinkResponseDto>.FailureResult($"Email delivery failed: {errReason}", responseData);
        }

        if (isWhatsApp || isSms)
        {
            return ApiResponse<SendKycLinkResponseDto>.FailureResult(deliveryStatus, responseData);
        }

        return ApiResponse<SendKycLinkResponseDto>.SuccessResponse(responseData, emailSent ? "KYC verification email dispatched successfully!" : "KYC verification link generated successfully");
    }

    public async Task<ApiResponse<KycDto>> SubmitKycAsync(int companyId, SubmitKycDto dto, CancellationToken ct = default)
    {
        InvestorKyc? kyc = null;

        if (!string.IsNullOrWhiteSpace(dto.Token))
        {
            kyc = await _kycRepo.GetByTokenAsync(dto.Token, ct);
            if (kyc == null)
                return ApiResponse<KycDto>.ErrorResponse("Invalid or expired KYC token");
        }
        else if (dto.InvestorId > 0)
        {
            kyc = await _kycRepo.GetByInvestorIdAsync(dto.InvestorId, companyId, ct);
        }
        else if (!string.IsNullOrWhiteSpace(dto.Email))
        {
            kyc = await _kycRepo.GetByEmailAsync(dto.Email, companyId, ct);
        }

        if (kyc == null)
        {
            return ApiResponse<KycDto>.ErrorResponse("KYC record not found");
        }

        if (kyc.Status == KycStatus.Approved)
        {
            return ApiResponse<KycDto>.ErrorResponse("This KYC has already been verified and approved.");
        }
        if (kyc.SubmittedAt != null && kyc.Status == KycStatus.PendingReview)
        {
            return ApiResponse<KycDto>.ErrorResponse("You have already submitted your KYC. It is currently awaiting IRM verification.");
        }

        if (dto.IsFinalSubmit)
        {
            if (!string.IsNullOrWhiteSpace(dto.PanNumber) && !IsValidPan(dto.PanNumber))
                return ApiResponse<KycDto>.ErrorResponse("Invalid PAN number format. Format must be 5 uppercase letters, 4 digits, 1 uppercase letter (e.g. ABCDE1234F).");

            if (!string.IsNullOrWhiteSpace(dto.AadhaarNumber) && !IsValidAadhaar(dto.AadhaarNumber))
                return ApiResponse<KycDto>.ErrorResponse("Invalid Aadhaar number format. Must be 12 numeric digits.");

            if (!string.IsNullOrWhiteSpace(dto.IfscCode) && !IsValidIfsc(dto.IfscCode))
                return ApiResponse<KycDto>.ErrorResponse("Invalid IFSC code format (e.g. HDFC0001234).");

            if (!string.IsNullOrWhiteSpace(dto.PanDocumentUrl) && dto.PanDocumentUrl.Length > 7 * 1024 * 1024)
                return ApiResponse<KycDto>.ErrorResponse("PAN document file size exceeds the 5 MB limit.");

            if (!string.IsNullOrWhiteSpace(dto.AadhaarDocumentUrl) && dto.AadhaarDocumentUrl.Length > 7 * 1024 * 1024)
                return ApiResponse<KycDto>.ErrorResponse("Aadhaar document file size exceeds the 5 MB limit.");
        }

        kyc.InvestorName = !string.IsNullOrWhiteSpace(dto.InvestorName) ? dto.InvestorName : kyc.InvestorName;
        kyc.Phone = !string.IsNullOrWhiteSpace(dto.Phone) ? dto.Phone : kyc.Phone;
        kyc.Email = !string.IsNullOrWhiteSpace(dto.Email) ? dto.Email : kyc.Email;
        kyc.FatherName = dto.FatherName ?? kyc.FatherName;
        kyc.DateOfBirth = dto.DateOfBirth ?? dto.Dob ?? kyc.DateOfBirth;
        kyc.NameAsPerPan = dto.NameAsPerPan ?? kyc.NameAsPerPan;
        kyc.Gender = dto.Gender ?? kyc.Gender;
        kyc.InvestorType = dto.InvestorType ?? kyc.InvestorType;
        kyc.ResidentType = dto.ResidentType ?? kyc.ResidentType;
        kyc.Occupation = dto.Occupation ?? kyc.Occupation;

        kyc.PanNumber = dto.PanNumber ?? kyc.PanNumber;
        kyc.AadhaarNumber = dto.AadhaarNumber ?? kyc.AadhaarNumber;
        kyc.AddressLine1 = dto.AddressLine1 ?? kyc.AddressLine1;
        kyc.AddressLine2 = dto.AddressLine2 ?? kyc.AddressLine2;
        kyc.City = dto.City ?? kyc.City;
        kyc.State = dto.State ?? kyc.State;
        kyc.Pincode = dto.Pincode ?? kyc.Pincode;
        kyc.Country = dto.Country ?? kyc.Country;

        kyc.BankName = dto.BankName ?? kyc.BankName;
        kyc.AccountNumber = dto.AccountNumber ?? kyc.AccountNumber;
        kyc.IfscCode = dto.IfscCode ?? kyc.IfscCode;
        kyc.AccountType = dto.AccountType ?? kyc.AccountType;
        kyc.DematAccountNumber = dto.DematAccountNumber ?? kyc.DematAccountNumber;
        kyc.DpId = dto.DpId ?? kyc.DpId;

        if (dto.NomineesJson != null)
        {
            kyc.NomineesJson = string.IsNullOrWhiteSpace(dto.NomineesJson) ? "[]" : dto.NomineesJson.Trim();
        }

        kyc.PanDocumentUrl = dto.PanDocumentUrl ?? kyc.PanDocumentUrl;
        kyc.AadhaarDocumentUrl = dto.AadhaarDocumentUrl ?? kyc.AadhaarDocumentUrl;
        kyc.BankChequeUrl = dto.BankChequeUrl ?? kyc.BankChequeUrl;
        kyc.DematDocumentUrl = dto.DematDocumentUrl ?? kyc.DematDocumentUrl;
        kyc.PhotoUrl = dto.PhotoUrl ?? kyc.PhotoUrl;
        kyc.SignatureUrl = dto.SignatureUrl ?? kyc.SignatureUrl;

        kyc.UpdatedAt = DateTime.UtcNow;

        if (dto.IsFinalSubmit)
        {
            kyc.Status = KycStatus.PendingReview;
            kyc.SubmittedAt = DateTime.UtcNow;
            kyc.VerifiedBy = null;
            kyc.VerifiedAt = null;
            kyc.Remarks = null;
            kyc.ReviewRemarks = null;
            kyc.FlaggedSectionsJson = null;
            // Invalidate the link token after submission so it cannot be reused
            kyc.KycLinkToken = null;
            kyc.KycLinkExpiresAt = null;
        }

        if (kyc.Id == 0)
            await _kycRepo.CreateAsync(kyc, ct);
        else
            await _kycRepo.UpdateAsync(kyc, ct);

        if (dto.IsFinalSubmit)
        {
            await SyncLeadAndFollowupsOnKycProgressionAsync(companyId, kyc.Phone, kyc.Email, kyc.InvestorName, kyc.Id, kyc.Status, ct);
        }

        return ApiResponse<KycDto>.SuccessResponse(MapToDto(kyc), dto.IsFinalSubmit ? "KYC submitted for review" : "KYC draft saved");
    }

    public async Task<ApiResponse<KycDto>> ReviewKycAsync(int id, int companyId, KycReviewDto dto, CancellationToken ct = default)
    {
        var kyc = await _kycRepo.GetByIdAsync(id, companyId, ct);
        if (kyc == null)
            return ApiResponse<KycDto>.ErrorResponse("KYC record not found");

        var allowedActions = new[] { "Approved", "Rejected", "ReuploadRequested" };
        if (string.IsNullOrWhiteSpace(dto.Action) || !allowedActions.Contains(dto.Action, StringComparer.OrdinalIgnoreCase) ||
            !Enum.TryParse<KycStatus>(dto.Action, true, out var status))
        {
            return ApiResponse<KycDto>.ErrorResponse("Invalid review action. Allowed: Approved, Rejected, ReuploadRequested");
        }

        if (status == KycStatus.Approved)
        {
            bool hasRealSubmission = kyc.SubmittedAt != null 
                || kyc.Status == KycStatus.PendingReview 
                || (kyc.IsAssisted && kyc.CustomerConsentObtained);

            if (!hasRealSubmission)
            {
                return ApiResponse<KycDto>.ErrorResponse("Cannot approve KYC: No genuine customer submission exists for this record.");
            }

            bool hasNominees = !string.IsNullOrWhiteSpace(kyc.NomineesJson) && kyc.NomineesJson.Trim() != "[]";
            if (dto.Checklist == null || !dto.Checklist.IsValid(hasNominees))
            {
                return ApiResponse<KycDto>.ErrorResponse("Required checklist items (Identity, Bank, Documents, Demat" + (hasNominees ? ", Nominee" : "") + ") must be verified.");
            }

            kyc.VerifiedAt = DateTime.UtcNow;
        }

        kyc.Status = status;
        kyc.ReviewRemarks = dto.Remarks;
        kyc.ReviewedAt = DateTime.UtcNow;

        // If approved, update the investor's status to ActiveInvestor or HnwInvestor
        if (kyc.Status == KycStatus.Approved)
        {
            var investor = await _investorRepo.GetByIdAsync(kyc.InvestorId, companyId, ct);
            if (investor != null)
            {
                investor.Status = InvestorStatus.ActiveInvestor;
                await _investorRepo.UpdateAsync(investor, ct);
            }
        }

        await _kycRepo.UpdateAsync(kyc, ct);
        await SyncLeadAndFollowupsOnKycProgressionAsync(companyId, kyc.Phone, kyc.Email, kyc.InvestorName, kyc.Id, kyc.Status, ct);
        return ApiResponse<KycDto>.SuccessResponse(MapToDto(kyc), $"KYC status updated to {kyc.Status}");
    }

    public async Task<ApiResponse<PublicKycDto>> GetByTokenAsync(string token, CancellationToken ct = default)
    {
        var kyc = await _kycRepo.GetByTokenAsync(token, ct);
        if (kyc == null)
            return ApiResponse<PublicKycDto>.ErrorResponse("Invalid or expired KYC token");

        if (kyc.IsRevoked)
            return ApiResponse<PublicKycDto>.ErrorResponse("This KYC link has been revoked or replaced by a fresh link.");

        if (kyc.KycLinkExpiresAt.HasValue && kyc.KycLinkExpiresAt.Value <= DateTime.UtcNow)
            return ApiResponse<PublicKycDto>.ErrorResponse("This KYC link has expired. Please request a new link.");

        // Return customer & draft info. Require verified OTP session before releasing unmasked sensitive PII
        bool isOtpVerified = await _otpService.HasVerifiedOtpAsync(token, kyc.Email, ct);

        var publicDto = new PublicKycDto
        {
            Id = kyc.Id,
            InvestorId = kyc.InvestorId,
            InvestorName = kyc.InvestorName,
            Email = kyc.Email,
            Phone = kyc.Phone,
            Status = kyc.Status.ToString(),
            IsExpired = kyc.KycLinkExpiresAt.HasValue && kyc.KycLinkExpiresAt.Value <= DateTime.UtcNow,
            ExpiresAt = kyc.KycLinkExpiresAt,

            FatherName = isOtpVerified ? kyc.FatherName : null,
            DateOfBirth = isOtpVerified ? kyc.DateOfBirth : null,
            Dob = isOtpVerified ? kyc.DateOfBirth : null,
            NameAsPerPan = isOtpVerified ? kyc.NameAsPerPan : null,
            Gender = kyc.Gender,
            InvestorType = kyc.InvestorType,
            ResidentType = kyc.ResidentType,
            Occupation = kyc.Occupation,

            PanNumber = isOtpVerified ? kyc.PanNumber : MaskPan(kyc.PanNumber),
            AadhaarNumber = isOtpVerified ? kyc.AadhaarNumber : MaskAadhaar(kyc.AadhaarNumber),
            AddressLine1 = isOtpVerified ? kyc.AddressLine1 : null,
            AddressLine2 = isOtpVerified ? kyc.AddressLine2 : null,
            City = kyc.City,
            State = kyc.State,
            Pincode = kyc.Pincode,
            Country = kyc.Country,

            BankName = kyc.BankName,
            AccountNumber = isOtpVerified ? kyc.AccountNumber : MaskAccount(kyc.AccountNumber),
            IfscCode = isOtpVerified ? kyc.IfscCode : null,
            AccountType = kyc.AccountType,
            DematAccountNumber = isOtpVerified ? kyc.DematAccountNumber : MaskAccount(kyc.DematAccountNumber),
            DpId = isOtpVerified ? kyc.DpId : null,

            NomineesJson = isOtpVerified ? kyc.NomineesJson : null,

            PanDocumentUrl = isOtpVerified ? kyc.PanDocumentUrl : null,
            AadhaarDocumentUrl = isOtpVerified ? kyc.AadhaarDocumentUrl : null,
            BankChequeUrl = isOtpVerified ? kyc.BankChequeUrl : null,
            DematDocumentUrl = isOtpVerified ? kyc.DematDocumentUrl : null,
            PhotoUrl = kyc.PhotoUrl,
            SignatureUrl = kyc.SignatureUrl,

            IsAssisted = kyc.IsAssisted,
            CustomerConsentObtained = kyc.CustomerConsentObtained,
            SubmittedAt = kyc.SubmittedAt
        };

        return ApiResponse<PublicKycDto>.SuccessResponse(publicDto);
    }

    public async Task<ApiResponse<KycDto>> GetByEmailAsync(string email, int companyId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(email))
            return ApiResponse<KycDto>.ErrorResponse("Email is required");

        var all = await _kycRepo.GetAllAsync(companyId, null, ct);
        var kyc = all.FirstOrDefault(k => string.Equals(k.Email, email, StringComparison.OrdinalIgnoreCase));
        if (kyc == null)
            return ApiResponse<KycDto>.ErrorResponse("KYC record not found for this email");

        return ApiResponse<KycDto>.SuccessResponse(MapToDto(kyc));
    }

    public Task<ApiResponse<List<KycListDto>>> GetAllAsync(int companyId, string? status, CancellationToken ct = default)
        => GetAllAsync(companyId, status, null, ct);

    public async Task<ApiResponse<List<KycListDto>>> GetAllAsync(int companyId, string? status, int? irmId, CancellationToken ct = default)
    {
        var list = await _kycRepo.GetAllAsync(companyId, status, irmId, ct);
        var matcher = await _otherService.GetOtherMatcherAsync(companyId, "kyc", irmId, ct);
        if (matcher.HasAnyOther)
        {
            list = list.Where(k => !matcher.IsInOther(k.Phone, k.InvestorId, null, k.InvestorName)).ToList();
        }
        var dtos = list.Select(MapToListDto).ToList();
        return ApiResponse<List<KycListDto>>.SuccessResponse(dtos);
    }

    public async Task<ApiResponse<KycDto>> SaveAssistedKycAsync(int companyId, int irmId, SubmitKycDto dto, CancellationToken ct = default)
    {
        InvestorKyc? kyc = null;

        if (dto.KycId.HasValue && dto.KycId.Value > 0)
        {
            kyc = await _kycRepo.GetByIdAsync(dto.KycId.Value, companyId, ct);
        }

        if (kyc == null && dto.InvestorId > 0)
        {
            kyc = await _kycRepo.GetByInvestorIdAsync(dto.InvestorId, companyId, ct);
        }
        if (kyc == null && !string.IsNullOrWhiteSpace(dto.Email))
        {
            kyc = await _kycRepo.GetByEmailAsync(dto.Email, companyId, ct);
        }

        if (kyc == null && !string.IsNullOrWhiteSpace(dto.Phone))
        {
            var phoneDigits = new string(dto.Phone.Where(char.IsDigit).ToArray());
            if (phoneDigits.Length >= 10)
            {
                var last10 = phoneDigits[^10..];
                kyc = await _kycRepo.GetByPhoneLast10Async(last10, companyId, ct);
            }
        }

        // Never overwrite an already Approved KYC
        if (kyc != null && kyc.Status == KycStatus.Approved)
        {
            return ApiResponse<KycDto>.SuccessResponse(MapToDto(kyc), "KYC is already verified and approved.");
        }

        // Never downgrade an already submitted KYC when just saving a draft
        if (kyc != null && kyc.SubmittedAt != null && kyc.Status == KycStatus.PendingReview && !dto.IsFinalSubmit)
        {
            return ApiResponse<KycDto>.SuccessResponse(MapToDto(kyc), "KYC is already submitted for review.");
        }

        // Resolve or create corresponding Investor record to satisfy FK_InvestorKycs_Investors_InvestorId
        Investor? investor = null;
        if (kyc != null && kyc.InvestorId > 0)
        {
            investor = await _investorRepo.GetByIdAsync(kyc.InvestorId, companyId, ct);
        }

        if (investor == null && dto.InvestorId > 0)
        {
            investor = await _investorRepo.GetByIdAsync(dto.InvestorId, companyId, ct);
        }

        var investorName = !string.IsNullOrWhiteSpace(dto.InvestorName) ? dto.InvestorName : (investor?.Name ?? "Valued Investor");
        var recipientEmail = !string.IsNullOrWhiteSpace(dto.Email) ? dto.Email : (investor?.Email ?? string.Empty);
        var recipientPhone = !string.IsNullOrWhiteSpace(dto.Phone) ? dto.Phone : (investor?.Phone ?? string.Empty);

        if (investor == null && !string.IsNullOrWhiteSpace(recipientEmail))
        {
            var allInvestors = await _investorRepo.GetAllAsync(companyId, null, null, null, ct);
            investor = allInvestors.FirstOrDefault(i => string.Equals(i.Email, recipientEmail, StringComparison.OrdinalIgnoreCase) ||
                                                       (!string.IsNullOrWhiteSpace(recipientPhone) && i.Phone == recipientPhone));
        }

        if (investor == null)
        {
            investor = new Investor
            {
                CompanyId = companyId,
                Name = investorName,
                Email = recipientEmail,
                Phone = recipientPhone,
                Status = InvestorStatus.Lead,
                AssignedIrmId = irmId > 0 ? irmId : null,
                CreatedAt = DateTime.UtcNow
            };
            investor = await _investorRepo.CreateAsync(investor, ct);
        }
        else if (investor.AssignedIrmId == null && irmId > 0)
        {
            investor.AssignedIrmId = irmId;
            await _investorRepo.UpdateAsync(investor, ct);
        }

        if (kyc == null)
        {
            kyc = await _kycRepo.GetByInvestorIdAsync(investor.Id, companyId, ct);
        }

        if (kyc == null)
        {
            kyc = new InvestorKyc
            {
                InvestorId = investor.Id,
                CompanyId = companyId,
                IrmId = irmId,
                InvestorName = investorName,
                Phone = recipientPhone,
                Email = recipientEmail,
                Status = dto.IsFinalSubmit ? KycStatus.PendingReview : KycStatus.Draft,
                CreatedAt = DateTime.UtcNow
            };
        }
        else
        {
            int effectiveIrmId = (kyc.IrmId.HasValue && kyc.IrmId.Value > 0) ? kyc.IrmId.Value : irmId;
            kyc.InvestorId = investor.Id;
            kyc.IrmId = effectiveIrmId;
            if (dto.IsFinalSubmit)
            {
                kyc.Status = KycStatus.PendingReview;
            }
            else if (kyc.Status != KycStatus.PendingReview && kyc.Status != KycStatus.Approved)
            {
                kyc.Status = KycStatus.Draft;
            }
        }

        if (dto.IsFinalSubmit)
        {
            if (!string.IsNullOrWhiteSpace(dto.PanNumber) && !IsValidPan(dto.PanNumber))
                return ApiResponse<KycDto>.ErrorResponse("Invalid PAN number format (e.g. ABCDE1234F).");
            if (!string.IsNullOrWhiteSpace(dto.AadhaarNumber) && !IsValidAadhaar(dto.AadhaarNumber))
                return ApiResponse<KycDto>.ErrorResponse("Invalid Aadhaar number format. Must be 12 numeric digits.");
            if (!string.IsNullOrWhiteSpace(dto.IfscCode) && !IsValidIfsc(dto.IfscCode))
                return ApiResponse<KycDto>.ErrorResponse("Invalid IFSC code format (e.g. HDFC0001234).");
        }

        kyc.InvestorName = !string.IsNullOrWhiteSpace(dto.InvestorName) ? dto.InvestorName : kyc.InvestorName;
        kyc.Phone = !string.IsNullOrWhiteSpace(dto.Phone) ? dto.Phone : kyc.Phone;
        kyc.Email = !string.IsNullOrWhiteSpace(dto.Email) ? dto.Email : kyc.Email;
        kyc.FatherName = dto.FatherName ?? kyc.FatherName;
        kyc.DateOfBirth = dto.DateOfBirth ?? dto.Dob ?? kyc.DateOfBirth;
        kyc.NameAsPerPan = dto.NameAsPerPan ?? kyc.NameAsPerPan;
        kyc.Gender = dto.Gender ?? kyc.Gender;
        kyc.InvestorType = dto.InvestorType ?? kyc.InvestorType;
        kyc.ResidentType = dto.ResidentType ?? kyc.ResidentType;
        kyc.Occupation = dto.Occupation ?? kyc.Occupation;

        kyc.PanNumber = dto.PanNumber ?? kyc.PanNumber;
        kyc.AadhaarNumber = dto.AadhaarNumber ?? kyc.AadhaarNumber;
        kyc.AddressLine1 = dto.AddressLine1 ?? kyc.AddressLine1;
        kyc.AddressLine2 = dto.AddressLine2 ?? kyc.AddressLine2;
        kyc.City = dto.City ?? kyc.City;
        kyc.State = dto.State ?? kyc.State;
        kyc.Pincode = dto.Pincode ?? kyc.Pincode;
        kyc.Country = dto.Country ?? kyc.Country;

        kyc.BankName = dto.BankName ?? kyc.BankName;
        kyc.AccountNumber = dto.AccountNumber ?? kyc.AccountNumber;
        kyc.IfscCode = dto.IfscCode ?? kyc.IfscCode;
        kyc.AccountType = dto.AccountType ?? kyc.AccountType;
        kyc.DematAccountNumber = dto.DematAccountNumber ?? kyc.DematAccountNumber;
        kyc.DpId = dto.DpId ?? kyc.DpId;

        if (dto.NomineesJson != null)
        {
            kyc.NomineesJson = string.IsNullOrWhiteSpace(dto.NomineesJson) ? "[]" : dto.NomineesJson.Trim();
        }

        kyc.PanDocumentUrl = dto.PanDocumentUrl ?? kyc.PanDocumentUrl;
        kyc.AadhaarDocumentUrl = dto.AadhaarDocumentUrl ?? kyc.AadhaarDocumentUrl;
        kyc.BankChequeUrl = dto.BankChequeUrl ?? kyc.BankChequeUrl;
        kyc.DematDocumentUrl = dto.DematDocumentUrl ?? kyc.DematDocumentUrl;
        kyc.PhotoUrl = dto.PhotoUrl ?? kyc.PhotoUrl;
        kyc.SignatureUrl = dto.SignatureUrl ?? kyc.SignatureUrl;

        kyc.UpdatedAt = DateTime.UtcNow;

        kyc.IsAssisted = true;
        kyc.AssistedByUserId = irmId;
        kyc.CustomerConsentObtained = dto.CustomerConsentObtained;
        kyc.CustomerConsentTimestamp = dto.CustomerConsentObtained
            ? (dto.CustomerConsentTimestamp ?? DateTime.UtcNow)
            : null;
        kyc.CustomerConsentDetails = dto.CustomerConsentObtained
            ? (!string.IsNullOrWhiteSpace(dto.CustomerConsentDetails) ? dto.CustomerConsentDetails.Trim() : "Customer verbal and electronic consent confirmed during assisted KYC session.")
            : null;

        // Reject assisted KYC submissions unless customer consent is confirmed
        if (dto.IsFinalSubmit && !dto.CustomerConsentObtained)
        {
            try
            {
                var irmUser = await _db.Users.FindAsync(new object[] { irmId }, ct);
                var rejectAudit = new AuditLog
                {
                    CompanyId = companyId,
                    Action = "ASSISTED_KYC_SUBMIT_REJECTED",
                    EntityType = "InvestorKyc",
                    EntityId = kyc.Id != 0 ? kyc.Id.ToString() : (dto.InvestorId > 0 ? dto.InvestorId.ToString() : "0"),
                    Details = $"Assisted KYC submission rejected: Customer consent was not confirmed by IRM ID {irmId} for investor '{kyc.InvestorName}'.",
                    ActorName = irmUser?.Name ?? $"IRM (ID: {irmId})",
                    ActorEmail = irmUser?.Email ?? string.Empty,
                    Timestamp = DateTime.UtcNow,
                    Module = "KYC_ASSISTED",
                    Status = "failed"
                };
                _db.AuditLogs.Add(rejectAudit);
                await _db.SaveChangesAsync(ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[SaveAssistedKycAsync] Failed to record reject audit log: {Message}", ex.Message);
            }

            return ApiResponse<KycDto>.ErrorResponse(
                "Assisted KYC submission rejected: Confirmed customer consent is required before submission. Please obtain and confirm customer consent.");
        }

        if (dto.IsFinalSubmit)
        {
            kyc.SubmittedAt = DateTime.UtcNow;
            kyc.VerifiedBy = null;
            kyc.VerifiedAt = null;
            kyc.Remarks = null;
            kyc.ReviewRemarks = null;
            kyc.FlaggedSectionsJson = null;
            kyc.KycLinkToken = null;
            kyc.KycLinkExpiresAt = null;
        }

        if (kyc.Id == 0)
            await _kycRepo.CreateAsync(kyc, ct);
        else
            await _kycRepo.UpdateAsync(kyc, ct);

        // Automatically cascade lifecycle progression to leads, followups, and pipeline deals
        await SyncLeadAndFollowupsOnKycProgressionAsync(companyId, kyc.Phone, kyc.Email, kyc.InvestorName, kyc.Id, kyc.Status, ct);

        // Record immutable backend audit log retaining full consent and submission details
        try
        {
            var irmUser = await _db.Users.FindAsync(new object[] { irmId }, ct);
            var audit = new AuditLog
            {
                CompanyId = companyId,
                Action = dto.IsFinalSubmit ? "ASSISTED_KYC_SUBMIT" : "ASSISTED_KYC_DRAFT",
                EntityType = "InvestorKyc",
                EntityId = kyc.Id.ToString(),
                Details = $"Assisted KYC {(dto.IsFinalSubmit ? "submitted for verification" : "draft saved")} by IRM ID {irmId} for investor '{kyc.InvestorName}' (Consent: {kyc.CustomerConsentObtained}, Timestamp: {kyc.CustomerConsentTimestamp:O}, Details: {kyc.CustomerConsentDetails})",
                ActorName = irmUser?.Name ?? $"IRM (ID: {irmId})",
                ActorEmail = irmUser?.Email ?? string.Empty,
                Timestamp = DateTime.UtcNow,
                Module = "KYC_ASSISTED",
                Status = "success"
            };
            _db.AuditLogs.Add(audit);
            await _db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[SaveAssistedKycAsync] Failed to record audit log: {Message}", ex.Message);
        }


        return ApiResponse<KycDto>.SuccessResponse(MapToDto(kyc), dto.IsFinalSubmit ? "Assisted KYC submitted for verification" : "Assisted KYC draft saved");
    }

    public async Task<ApiResponse<bool>> RevokeKycLinkAsync(int id, int companyId, int? irmId, CancellationToken ct = default)
    {
        var kyc = await _kycRepo.GetByIdAsync(id, companyId, ct);
        if (kyc == null)
        {
            kyc = await _kycRepo.GetByInvestorIdAsync(id, companyId, ct);
        }
        if (kyc == null)
            return ApiResponse<bool>.ErrorResponse("KYC record not found");

        if (irmId.HasValue && irmId.Value > 0 && kyc.IrmId.HasValue && kyc.IrmId.Value != irmId.Value)
        {
            return ApiResponse<bool>.ErrorResponse("Access denied: You can only revoke KYC records assigned to you.");
        }

        kyc.IsRevoked = true;
        kyc.RevokedAt = DateTime.UtcNow;
        kyc.KycLinkToken = null;
        kyc.KycLinkExpiresAt = null;
        kyc.UpdatedAt = DateTime.UtcNow;

        await _kycRepo.UpdateAsync(kyc, ct);

        try
        {
            var user = irmId.HasValue ? await _db.Users.FindAsync(new object[] { irmId.Value }, ct) : null;
            var audit = new AuditLog
            {
                CompanyId = companyId,
                Action = "REVOKE_KYC_LINK",
                EntityType = "InvestorKyc",
                EntityId = kyc.Id.ToString(),
                Details = $"KYC link revoked for investor '{kyc.InvestorName}'",
                ActorName = user?.Name ?? $"User #{irmId}",
                ActorEmail = user?.Email ?? string.Empty,
                Timestamp = DateTime.UtcNow,
                Module = "KYC",
                Status = "success"
            };
            _db.AuditLogs.Add(audit);
            await _db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[RevokeKycLinkAsync] Audit log failed: {Message}", ex.Message);
        }

        return ApiResponse<bool>.SuccessResponse(true, "KYC link has been revoked.");
    }

    public async Task<ApiResponse<SendKycLinkResponseDto>> ResendKycLinkAsync(int id, int companyId, int irmId, ResendKycLinkDto? dto, CancellationToken ct = default)
    {
        var kyc = await _kycRepo.GetByIdAsync(id, companyId, ct);
        if (kyc == null)
        {
            kyc = await _kycRepo.GetByInvestorIdAsync(id, companyId, ct);
        }
        if (kyc == null)
            return ApiResponse<SendKycLinkResponseDto>.ErrorResponse("KYC record not found");

        if (kyc.Status == KycStatus.Approved)
            return ApiResponse<SendKycLinkResponseDto>.ErrorResponse("This KYC has already been approved and verified.");

        var sendDto = new SendKycLinkDto
        {
            InvestorId = kyc.InvestorId,
            InvestorName = kyc.InvestorName,
            Email = kyc.Email,
            Phone = kyc.Phone,
            ExpiryDays = dto?.ExpiryDays ?? 7,
            ForceNewToken = true,
            BaseUrl = dto?.BaseUrl
        };

        return await SendKycLinkAsync(companyId, irmId, sendDto, ct);
    }

    private static KycListDto MapToListDto(InvestorKyc k) => new()
    {
        Id = k.Id,
        InvestorId = k.InvestorId,
        CompanyId = k.CompanyId,
        IrmId = k.IrmId,
        Status = k.Status.ToString(),
        InvestorName = k.InvestorName,
        Phone = k.Phone,
        Email = k.Email,
        FatherName = k.FatherName,
        DateOfBirth = k.DateOfBirth,
        NameAsPerPan = k.NameAsPerPan,
        Gender = k.Gender,
        InvestorType = k.InvestorType,
        ResidentType = k.ResidentType,
        Occupation = k.Occupation,
        PanNumber = k.PanNumber,
        AadhaarNumber = MaskAadhaar(k.AadhaarNumber),
        AddressLine1 = k.AddressLine1,
        AddressLine2 = k.AddressLine2,
        City = k.City,
        State = k.State,
        Pincode = k.Pincode,
        Country = k.Country,
        BankName = k.BankName,
        AccountNumber = MaskAccount(k.AccountNumber),
        IfscCode = k.IfscCode,
        AccountType = k.AccountType,
        DematAccountNumber = MaskAccount(k.DematAccountNumber),
        DpId = k.DpId,
        NomineesJson = k.NomineesJson,
        HasPanDocument = !string.IsNullOrWhiteSpace(k.PanDocumentUrl),
        HasAadhaarDocument = !string.IsNullOrWhiteSpace(k.AadhaarDocumentUrl),
        HasPhoto = !string.IsNullOrWhiteSpace(k.PhotoUrl),
        ReviewRemarks = k.ReviewRemarks,
        ReviewedAt = k.ReviewedAt,
        VerifiedBy = k.VerifiedBy,
        VerifiedAt = k.VerifiedAt,
        Remarks = k.Remarks,
        FlaggedSections = k.FlaggedSectionsJson,
        KycLinkSent = k.KycLinkSent,
        KycLinkSentAt = k.KycLinkSentAt,
        SubmittedAt = k.SubmittedAt,
        IsAssisted = k.IsAssisted,
        CustomerConsentObtained = k.CustomerConsentObtained,
        CreatedAt = k.CreatedAt,
        UpdatedAt = k.UpdatedAt
    };

    private static KycDto MapToDto(InvestorKyc k) => new()
    {
        Id = k.Id,
        InvestorId = k.InvestorId,
        CompanyId = k.CompanyId,
        IrmId = k.IrmId,
        Status = k.Status.ToString(),
        InvestorName = k.InvestorName,
        Phone = k.Phone,
        Email = k.Email,
        FatherName = k.FatherName,
        DateOfBirth = k.DateOfBirth,
        NameAsPerPan = k.NameAsPerPan,
        Gender = k.Gender,
        InvestorType = k.InvestorType,
        ResidentType = k.ResidentType,
        Occupation = k.Occupation,
        PanNumber = k.PanNumber,
        AadhaarNumber = k.AadhaarNumber,
        AddressLine1 = k.AddressLine1,
        AddressLine2 = k.AddressLine2,
        City = k.City,
        State = k.State,
        Pincode = k.Pincode,
        Country = k.Country,
        BankName = k.BankName,
        AccountNumber = k.AccountNumber,
        IfscCode = k.IfscCode,
        AccountType = k.AccountType,
        DematAccountNumber = k.DematAccountNumber,
        DpId = k.DpId,
        NomineesJson = k.NomineesJson,
        PanDocumentUrl = k.PanDocumentUrl,
        AadhaarDocumentUrl = k.AadhaarDocumentUrl,
        BankChequeUrl = k.BankChequeUrl,
        DematDocumentUrl = k.DematDocumentUrl,
        PhotoUrl = k.PhotoUrl,
        SignatureUrl = k.SignatureUrl,
        ReviewRemarks = k.ReviewRemarks,
        ReviewedAt = k.ReviewedAt,
        VerifiedBy = k.VerifiedBy,
        VerifiedAt = k.VerifiedAt,
        Remarks = k.Remarks,
        FlaggedSections = k.FlaggedSectionsJson,
        KycLinkSent = k.KycLinkSent,
        KycLinkSentAt = k.KycLinkSentAt,
        SubmittedAt = k.SubmittedAt,
        IsAssisted = k.IsAssisted,
        AssistedByUserId = k.AssistedByUserId,
        CustomerConsentObtained = k.CustomerConsentObtained,
        CustomerConsentTimestamp = k.CustomerConsentTimestamp,
        KycLinkToken = k.KycLinkToken,
        KycLinkExpiresAt = k.KycLinkExpiresAt,
        CreatedAt = k.CreatedAt,
        UpdatedAt = k.UpdatedAt
    };

    private async Task SyncLeadAndFollowupsOnKycProgressionAsync(
        int companyId, 
        string? phone, 
        string? email, 
        string? name, 
        int kycId, 
        KycStatus kycStatus, 
        CancellationToken ct)
    {
        try
        {
            var phoneDigits = !string.IsNullOrWhiteSpace(phone)
                ? new string(phone.Where(char.IsDigit).ToArray())
                : string.Empty;
            var phoneLast10 = phoneDigits.Length >= 10 ? phoneDigits[^10..] : phoneDigits;
            var cleanEmail = (email ?? string.Empty).Trim().ToLowerInvariant();
            var cleanName = (name ?? string.Empty).Trim().ToLowerInvariant();

            // 1. Advance corresponding Lead in Leads table
            var leads = await _db.Leads
                .Where(l => l.CompanyId == companyId)
                .ToListAsync(ct);

            var matchedLead = leads.FirstOrDefault(l =>
            {
                if (!string.IsNullOrWhiteSpace(phoneLast10))
                {
                    var lDigits = new string(l.Phone.Where(char.IsDigit).ToArray());
                    if (lDigits.EndsWith(phoneLast10)) return true;
                }
                if (!string.IsNullOrWhiteSpace(cleanEmail) && !string.IsNullOrWhiteSpace(l.Email))
                {
                    if (l.Email.Trim().ToLowerInvariant() == cleanEmail) return true;
                }
                if (!string.IsNullOrWhiteSpace(cleanName) && !string.IsNullOrWhiteSpace(l.Name))
                {
                    if (l.Name.Trim().ToLowerInvariant() == cleanName) return true;
                }
                return false;
            });

            if (matchedLead != null)
            {
                if (!string.Equals(matchedLead.Status, "Converted", StringComparison.OrdinalIgnoreCase))
                {
                    matchedLead.Status = kycStatus == KycStatus.Approved ? "Converted" : "Qualified";
                    matchedLead.UpdatedAt = DateTime.UtcNow;
                }
            }

            // 2. Complete open/pending follow-ups
            var openFollowups = await _db.Followups
                .Where(f => f.CompanyId == companyId && f.Status == FollowupStatus.Pending)
                .ToListAsync(ct);

            foreach (var f in openFollowups)
            {
                bool isMatch = false;
                if (matchedLead != null && f.ContactId == matchedLead.Id.ToString())
                {
                    isMatch = true;
                }
                else if (!string.IsNullOrWhiteSpace(phoneLast10) && !string.IsNullOrWhiteSpace(f.ContactPhone))
                {
                    var fDigits = new string(f.ContactPhone.Where(char.IsDigit).ToArray());
                    if (fDigits.EndsWith(phoneLast10)) isMatch = true;
                }
                else if (!string.IsNullOrWhiteSpace(cleanName) && !string.IsNullOrWhiteSpace(f.ContactName))
                {
                    if (f.ContactName.Trim().ToLowerInvariant() == cleanName) isMatch = true;
                }

                if (isMatch)
                {
                    f.Status = FollowupStatus.Completed;
                    f.CompletedAt = DateTime.UtcNow;
                    var autoNote = "[System]: Auto-completed upon KYC progression";
                    f.Notes = string.IsNullOrWhiteSpace(f.Notes) ? autoNote : $"{f.Notes} | {autoNote}";
                }
            }

            // 3. Link or advance corresponding GhlDeal
            var deals = await _db.GhlDeals
                .Include(d => d.Customer)
                .Where(d => d.CompanyId == companyId)
                .ToListAsync(ct);

            var matchedDeal = deals.FirstOrDefault(d =>
            {
                if (d.KycId == kycId) return true;
                if (matchedLead != null && d.CustomerId == matchedLead.Id) return true;
                if (!string.IsNullOrWhiteSpace(phoneLast10))
                {
                    var dPhone = d.Customer?.Phone;
                    if (!string.IsNullOrWhiteSpace(dPhone))
                    {
                        var dDigits = new string(dPhone.Where(char.IsDigit).ToArray());
                        if (dDigits.EndsWith(phoneLast10)) return true;
                    }
                }
                if (!string.IsNullOrWhiteSpace(cleanEmail))
                {
                    var dEmail = d.Customer?.Email;
                    if (!string.IsNullOrWhiteSpace(dEmail) && dEmail.Trim().ToLowerInvariant() == cleanEmail) return true;
                }
                if (!string.IsNullOrWhiteSpace(cleanName) && !string.IsNullOrWhiteSpace(d.CustomerName))
                {
                    if (d.CustomerName.Trim().ToLowerInvariant() == cleanName) return true;
                }
                return false;
            });

            if (matchedDeal != null)
            {
                matchedDeal.KycId = kycId;
                if (kycStatus == KycStatus.Approved)
                {
                    matchedDeal.KycStatus = "Verified";
                }
                else if (kycStatus == KycStatus.Rejected)
                {
                    matchedDeal.KycStatus = "Rejected";
                }
                else
                {
                    matchedDeal.KycStatus = "PendingReview";
                    if (string.IsNullOrWhiteSpace(matchedDeal.Stage) || matchedDeal.Stage == "new" || matchedDeal.Stage == "followup")
                    {
                        matchedDeal.Stage = "qualified_investor";
                    }
                }
                matchedDeal.UpdatedAt = DateTime.UtcNow;
            }

            await _db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[SyncLeadAndFollowupsOnKycProgressionAsync] Failed to cascade KYC lifecycle to leads/followups: {Message}", ex.Message);
        }
    }
}
