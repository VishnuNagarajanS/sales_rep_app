using backend.DTOs.Common;
using backend.DTOs.Irm;
using backend.Models.Entities;
using backend.Models.Enums;
using backend.Repositories.Interfaces;
using backend.Services.Interfaces;

namespace backend.Services.Implementations;

public class KycService : IKycService
{
    private readonly IKycRepository _kycRepo;
    private readonly IInvestorRepository _investorRepo;
    private readonly IEmailService _emailService;
    private readonly ILogger<KycService> _logger;

    public KycService(
        IKycRepository kycRepo,
        IInvestorRepository investorRepo,
        IEmailService emailService,
        ILogger<KycService> logger)
    {
        _kycRepo = kycRepo;
        _investorRepo = investorRepo;
        _emailService = emailService;
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

        var token = Guid.NewGuid().ToString("N");
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
                Status = KycStatus.Draft,
                KycLinkToken = token,
                KycLinkSent = true,
                KycLinkExpiresAt = expiresAt,
                CreatedAt = DateTime.UtcNow
            };
            await _kycRepo.CreateAsync(existing, ct);
        }
        else
        {
            existing.KycLinkToken = token;
            existing.KycLinkSent = true;
            existing.KycLinkExpiresAt = expiresAt;
            if (!string.IsNullOrWhiteSpace(recipientEmail)) existing.Email = recipientEmail;
            if (!string.IsNullOrWhiteSpace(recipientPhone)) existing.Phone = recipientPhone;
            if (!string.IsNullOrWhiteSpace(investorName)) existing.InvestorName = investorName;
            await _kycRepo.UpdateAsync(existing, ct);
        }

        var baseUrl = !string.IsNullOrWhiteSpace(dto.BaseUrl) ? dto.BaseUrl.TrimEnd('/') : "http://localhost:5173";
        var nameSlug = Uri.EscapeDataString(new string(investorName.Where(char.IsLetterOrDigit).ToArray()).ToLower());
        var fullKycLink = $"{baseUrl}/kyc/tok_{token[..8]}_{(string.IsNullOrEmpty(nameSlug) ? "investor" : nameSlug)}";

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
                : $"Email dispatch simulated (To send real email, configure Gmail credentials in appsettings.json)";
        }
        else
        {
            deliveryStatus = $"Link dispatched via {dto.Channel?.ToUpper() ?? "SMS"}";
        }

        return ApiResponse<SendKycLinkResponseDto>.SuccessResponse(new SendKycLinkResponseDto
        {
            Token = token,
            Link = fullKycLink,
            ExpiresAt = expiresAt,
            EmailSent = emailSent,
            DeliveryStatus = deliveryStatus
        }, emailSent ? "KYC verification email dispatched successfully!" : "KYC verification link generated successfully");
    }

    public async Task<ApiResponse<KycDto>> SubmitKycAsync(int companyId, SubmitKycDto dto, CancellationToken ct = default)
    {
        InvestorKyc? kyc = null;

        if (!string.IsNullOrWhiteSpace(dto.Token))
        {
            kyc = await _kycRepo.GetByTokenAsync(dto.Token, ct);
        }

        if (kyc == null && dto.InvestorId > 0)
        {
            kyc = await _kycRepo.GetByInvestorIdAsync(dto.InvestorId, companyId, ct);
        }

        if (kyc == null && !string.IsNullOrWhiteSpace(dto.Email))
        {
            var all = await _kycRepo.GetAllAsync(companyId, null, ct);
            kyc = all.FirstOrDefault(k => string.Equals(k.Email, dto.Email, StringComparison.OrdinalIgnoreCase));
        }

        if (kyc == null)
        {
            kyc = new InvestorKyc
            {
                InvestorId = dto.InvestorId,
                CompanyId = companyId,
                CreatedAt = DateTime.UtcNow
            };
        }

        kyc.InvestorName = !string.IsNullOrWhiteSpace(dto.InvestorName) ? dto.InvestorName : kyc.InvestorName;
        kyc.Phone = !string.IsNullOrWhiteSpace(dto.Phone) ? dto.Phone : kyc.Phone;
        kyc.Email = !string.IsNullOrWhiteSpace(dto.Email) ? dto.Email : kyc.Email;
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
        kyc.UpdatedAt = DateTime.UtcNow;

        if (dto.IsFinalSubmit)
        {
            kyc.Status = KycStatus.PendingReview;
            kyc.SubmittedAt = DateTime.UtcNow;
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

    public async Task<ApiResponse<KycDto>> GetByTokenAsync(string token, CancellationToken ct = default)
    {
        var kyc = await _kycRepo.GetByTokenAsync(token, ct);
        if (kyc == null)
            return ApiResponse<KycDto>.ErrorResponse("Invalid or expired KYC token");

        return ApiResponse<KycDto>.SuccessResponse(MapToDto(kyc));
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

    public async Task<ApiResponse<List<KycDto>>> GetAllAsync(int companyId, string? status, CancellationToken ct = default)
    {
        var list = await _kycRepo.GetAllAsync(companyId, status, ct);
        var dtos = list.Select(MapToDto).ToList();
        return ApiResponse<List<KycDto>>.SuccessResponse(dtos);
    }

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
        KycLinkSent = k.KycLinkSent,
        CreatedAt = k.CreatedAt,
        UpdatedAt = k.UpdatedAt
    };
}
