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

    public KycService(
        IKycRepository kycRepo,
        IInvestorRepository investorRepo,
        IEmailService emailService,
        IOtpService otpService,
        ApplicationDbContext db,
        ILogger<KycService> logger)
    {
        _kycRepo = kycRepo;
        _investorRepo = investorRepo;
        _emailService = emailService;
        _otpService = otpService;
        _db = db;
        _logger = logger;
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

        // Cryptographically secure token (32 random bytes -> 64 hex characters)
        var rawToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        var tokenHash = HashToken(rawToken);

        var days = dto.Expiry?.ToLower() switch
        {
            "24h" => 1,
            "48h" => 2,
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
            var all = await _kycRepo.GetAllAsync(companyId, null, ct);
            existing = all.FirstOrDefault(k => string.Equals(k.Email, recipientEmail, StringComparison.OrdinalIgnoreCase));
        }

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
                // LinkSent: link dispatched, customer has NOT yet submitted
                Status = KycStatus.LinkSent,
                KycLinkToken = rawToken,
                KycTokenHash = tokenHash,
                IsRevoked = false,
                KycLinkSent = true,
                KycLinkSentAt = DateTime.UtcNow,
                KycLinkExpiresAt = expiresAt,
                CreatedAt = DateTime.UtcNow,
                HandoverId = investor?.HandoverId,
                OriginalOwnerId = investor?.OriginalOwnerId
            };
            await _kycRepo.CreateAsync(existing, ct);

            if (investor?.HandoverId != null)
            {
                _db.WorkHandoverItems.Add(new WorkHandoverItem
                {
                    HandoverId = investor.HandoverId.Value,
                    EntityType = "InvestorKyc",
                    EntityId = existing.Id,
                    Origin = "created_during_coverage"
                });
                await _db.SaveChangesAsync(ct);
            }
        }
        else
        {
            // Resend: Invalidate and revoke the previous link and pending OTPs
            if (!string.IsNullOrWhiteSpace(existing.KycLinkToken))
            {
                await _otpService.InvalidateOtpAsync(existing.KycLinkToken, existing.Email, ct);
            }

            existing.KycLinkToken = rawToken;
            existing.KycTokenHash = tokenHash;
            existing.IsRevoked = false;
            existing.RevokedAt = null;
            existing.KycLinkSent = true;
            existing.KycLinkSentAt = DateTime.UtcNow;
            existing.KycLinkExpiresAt = expiresAt;
            if (!string.IsNullOrWhiteSpace(recipientEmail)) existing.Email = recipientEmail;
            if (!string.IsNullOrWhiteSpace(recipientPhone)) existing.Phone = recipientPhone;
            if (!string.IsNullOrWhiteSpace(investorName)) existing.InvestorName = investorName;

            // Upgrade Draft/LinkSent to LinkSent; do NOT mark Completed or downgrade an already reviewed record
            if (existing.Status == KycStatus.Draft || existing.Status == KycStatus.LinkSent)
                existing.Status = KycStatus.LinkSent;

            await _kycRepo.UpdateAsync(existing, ct);
        }

        var baseUrl = !string.IsNullOrWhiteSpace(dto.BaseUrl) ? dto.BaseUrl.TrimEnd('/') : "http://localhost:5173";
        var fullKycLink = $"{baseUrl}/kyc/{rawToken}";

        bool emailSent = false;
        string deliveryStatus = "Generated";

        if ((string.IsNullOrWhiteSpace(dto.Channel) || dto.Channel.Equals("email", StringComparison.OrdinalIgnoreCase)) 
            && !string.IsNullOrWhiteSpace(recipientEmail))
        {
            emailSent = await _emailService.SendKycVerificationLinkAsync(
                recipientEmail,
                investorName,
                fullKycLink,
                dto.Expiry ?? "48 Hours",
                ct);

            deliveryStatus = emailSent 
                ? $"Email delivered successfully to {recipientEmail} via Gmail SMTP" 
                : $"Email could not be sent: {_emailService.LastError ?? "SMTP service delivery failed"}";
        }
        else if (string.Equals(dto.Channel, "email", StringComparison.OrdinalIgnoreCase))
        {
            deliveryStatus = "Email not sent: no email address was found for this investor.";
        }
        else
        {
            deliveryStatus = $"Link dispatched via {dto.Channel?.ToUpper() ?? "SMS"}";
        }

        var responseData = new SendKycLinkResponseDto
        {
            Token = rawToken,
            Link = fullKycLink,
            ExpiresAt = expiresAt,
            EmailSent = emailSent,
            DeliveryStatus = deliveryStatus
        };

        if ((string.IsNullOrWhiteSpace(dto.Channel) || dto.Channel.Equals("email", StringComparison.OrdinalIgnoreCase)) && !emailSent)
        {
            return ApiResponse<SendKycLinkResponseDto>.SuccessResponse(responseData, $"KYC verification link generated, but email delivery failed: {_emailService.LastError ?? "SMTP delivery failed"}. Please check email configuration.");
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
            var all = await _kycRepo.GetAllAsync(companyId, null, ct);
            kyc = all.FirstOrDefault(k => string.Equals(k.Email, dto.Email, StringComparison.OrdinalIgnoreCase));
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

        kyc.NomineesJson = dto.NomineesJson ?? kyc.NomineesJson;

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

        return ApiResponse<KycDto>.SuccessResponse(MapToDto(kyc), dto.IsFinalSubmit ? "KYC submitted for review" : "KYC draft saved");
    }

    public async Task<ApiResponse<KycDto>> ReviewKycAsync(int id, int companyId, KycReviewDto dto, CancellationToken ct = default)
    {
        var kyc = await _kycRepo.GetByIdAsync(id, companyId, ct);
        if (kyc == null)
            return ApiResponse<KycDto>.ErrorResponse("KYC record not found");

        if (Enum.TryParse<KycStatus>(dto.Action, true, out var status))
        {
            kyc.Status = status;
        }
        else
        {
            return ApiResponse<KycDto>.ErrorResponse("Invalid review action. Allowed: Approved, Rejected, ReuploadRequested");
        }

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

        if (kyc.Status == KycStatus.Approved)
            return ApiResponse<PublicKycDto>.ErrorResponse("This KYC has already been verified and approved.");

        if (kyc.SubmittedAt != null && kyc.Status == KycStatus.PendingReview)
            return ApiResponse<PublicKycDto>.ErrorResponse("You have already submitted your KYC. It is currently awaiting IRM verification.");

        // Return minimum customer info needed for form pre-fill
        var publicDto = new PublicKycDto
        {
            InvestorName = kyc.InvestorName,
            Email = kyc.Email,
            Phone = kyc.Phone,
            Status = kyc.Status.ToString(),
            IsExpired = kyc.KycLinkExpiresAt.HasValue && kyc.KycLinkExpiresAt.Value <= DateTime.UtcNow,
            ExpiresAt = kyc.KycLinkExpiresAt
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
        var dtos = list.Select(MapToListDto).ToList();
        return ApiResponse<List<KycListDto>>.SuccessResponse(dtos);
    }

    public async Task<ApiResponse<KycDto>> SaveAssistedKycAsync(int companyId, int irmId, SubmitKycDto dto, CancellationToken ct = default)
    {
        InvestorKyc? kyc = null;

        if (dto.InvestorId > 0)
        {
            kyc = await _kycRepo.GetByInvestorIdAsync(dto.InvestorId, companyId, ct);
        }
        else if (!string.IsNullOrWhiteSpace(dto.Email))
        {
            var all = await _kycRepo.GetAllAsync(companyId, null, ct);
            kyc = all.FirstOrDefault(k => string.Equals(k.Email, dto.Email, StringComparison.OrdinalIgnoreCase));
        }

        if (kyc == null && !string.IsNullOrWhiteSpace(dto.Phone))
        {
            var phoneDigits = new string(dto.Phone.Where(char.IsDigit).ToArray());
            if (phoneDigits.Length >= 10)
            {
                var last10 = phoneDigits[^10..];
                var all = await _kycRepo.GetAllAsync(companyId, null, ct);
                kyc = all.FirstOrDefault(k => (k.Phone ?? string.Empty).Replace("-", string.Empty).Replace(" ", string.Empty).EndsWith(last10));
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

        if (kyc == null)
        {
            int? inheritedHandoverId = null;
            int? inheritedOriginalOwnerId = null;
            if (dto.InvestorId > 0)
            {
                var inv = await _investorRepo.GetByIdAsync(dto.InvestorId, companyId, ct);
                if (inv != null)
                {
                    inheritedHandoverId = inv.HandoverId;
                    inheritedOriginalOwnerId = inv.OriginalOwnerId;
                }
            }

            kyc = new InvestorKyc
            {
                InvestorId = dto.InvestorId,
                CompanyId = companyId,
                IrmId = irmId,
                InvestorName = dto.InvestorName ?? string.Empty,
                Phone = dto.Phone ?? string.Empty,
                Email = dto.Email ?? string.Empty,
                Status = dto.IsFinalSubmit ? KycStatus.PendingReview : KycStatus.Draft,
                CreatedAt = DateTime.UtcNow,
                HandoverId = inheritedHandoverId,
                OriginalOwnerId = inheritedOriginalOwnerId
            };
        }
        else
        {
            kyc.IrmId = irmId;
            if (dto.IsFinalSubmit)
            {
                kyc.Status = KycStatus.PendingReview;
            }
            else if (kyc.Status != KycStatus.PendingReview && kyc.Status != KycStatus.Approved)
            {
                kyc.Status = KycStatus.Draft;
            }
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

        kyc.NomineesJson = dto.NomineesJson ?? kyc.NomineesJson;

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
            var rejectAudit = new AuditLog
            {
                CompanyId = companyId,
                Action = "ASSISTED_KYC_SUBMIT_REJECTED",
                EntityType = "InvestorKyc",
                EntityId = kyc.Id != 0 ? kyc.Id.ToString() : (dto.InvestorId > 0 ? dto.InvestorId.ToString() : "0"),
                Details = $"Assisted KYC submission rejected: Customer consent was not confirmed by IRM ID {irmId} for investor '{kyc.InvestorName}'.",
                ActorName = $"IRM (ID: {irmId})",
                Timestamp = DateTime.UtcNow,
                Module = "KYC_ASSISTED",
                Status = "failed"
            };
            _db.AuditLogs.Add(rejectAudit);
            await _db.SaveChangesAsync(ct);

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

        bool isNew = kyc.Id == 0;
        if (isNew)
            await _kycRepo.CreateAsync(kyc, ct);
        else
            await _kycRepo.UpdateAsync(kyc, ct);

        if (isNew && kyc.HandoverId.HasValue)
        {
            _db.WorkHandoverItems.Add(new WorkHandoverItem
            {
                HandoverId = kyc.HandoverId.Value,
                EntityType = "InvestorKyc",
                EntityId = kyc.Id,
                Origin = "created_during_coverage"
            });
            await _db.SaveChangesAsync(ct);
        }

        // Record immutable backend audit log retaining full consent and submission details
        var audit = new AuditLog
        {
            CompanyId = companyId,
            Action = dto.IsFinalSubmit ? "ASSISTED_KYC_SUBMIT" : "ASSISTED_KYC_DRAFT",
            EntityType = "InvestorKyc",
            EntityId = kyc.Id.ToString(),
            Details = $"Assisted KYC {(dto.IsFinalSubmit ? "submitted for verification" : "draft saved")} by IRM ID {irmId} for investor '{kyc.InvestorName}' (Consent: {kyc.CustomerConsentObtained}, Timestamp: {kyc.CustomerConsentTimestamp:O}, Details: {kyc.CustomerConsentDetails})",
            ActorName = $"IRM (ID: {irmId})",
            Timestamp = DateTime.UtcNow,
            Module = "KYC_ASSISTED",
            Status = "success"
        };
        _db.AuditLogs.Add(audit);
        await _db.SaveChangesAsync(ct);

        return ApiResponse<KycDto>.SuccessResponse(MapToDto(kyc), dto.IsFinalSubmit ? "Assisted KYC submitted for verification" : "Assisted KYC draft saved");
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
        UpdatedAt = k.UpdatedAt,
        HandoverId = k.HandoverId,
        HandedOverFromName = k.OriginalOwner?.Name,
        HandoverPlannedEnd = k.Handover?.PlannedEndAt,
        OriginalOwnerId = k.OriginalOwnerId
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
        CreatedAt = k.CreatedAt,
        UpdatedAt = k.UpdatedAt,
        HandoverId = k.HandoverId,
        HandedOverFromName = k.OriginalOwner?.Name,
        HandoverPlannedEnd = k.Handover?.PlannedEndAt,
        OriginalOwnerId = k.OriginalOwnerId
    };
}
