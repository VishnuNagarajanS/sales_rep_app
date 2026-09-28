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

    public KycService(IKycRepository kycRepo, IInvestorRepository investorRepo)
    {
        _kycRepo = kycRepo;
        _investorRepo = investorRepo;
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
        var investor = await _investorRepo.GetByIdAsync(dto.InvestorId, companyId, ct);
        if (investor == null)
            return ApiResponse<SendKycLinkResponseDto>.ErrorResponse("Investor not found");

        var token = Guid.NewGuid().ToString("N");
        var expiresAt = DateTime.UtcNow.AddDays(7);

        var existing = await _kycRepo.GetByInvestorIdAsync(dto.InvestorId, companyId, ct);
        if (existing == null)
        {
            existing = new InvestorKyc
            {
                InvestorId = dto.InvestorId,
                CompanyId = companyId,
                IrmId = irmId,
                InvestorName = investor.Name,
                Phone = dto.Phone,
                Email = dto.Email ?? investor.Email,
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
            await _kycRepo.UpdateAsync(existing, ct);
        }

        var link = $"/investor-kyc?token={token}";
        return ApiResponse<SendKycLinkResponseDto>.SuccessResponse(new SendKycLinkResponseDto
        {
            Token = token,
            Link = link,
            ExpiresAt = expiresAt
        }, "KYC verification link generated successfully");
    }

    public async Task<ApiResponse<KycDto>> SubmitKycAsync(int companyId, SubmitKycDto dto, CancellationToken ct = default)
    {
        var kyc = await _kycRepo.GetByInvestorIdAsync(dto.InvestorId, companyId, ct);
        if (kyc == null)
        {
            kyc = new InvestorKyc
            {
                InvestorId = dto.InvestorId,
                CompanyId = companyId,
                CreatedAt = DateTime.UtcNow
            };
        }

        kyc.InvestorName = dto.InvestorName;
        kyc.Phone = dto.Phone;
        kyc.Email = dto.Email;
        kyc.Gender = dto.Gender;
        kyc.InvestorType = dto.InvestorType;
        kyc.ResidentType = dto.ResidentType;
        kyc.Occupation = dto.Occupation;

        kyc.PanNumber = dto.PanNumber;
        kyc.AadhaarNumber = dto.AadhaarNumber;
        kyc.AddressLine1 = dto.AddressLine1;
        kyc.AddressLine2 = dto.AddressLine2;
        kyc.City = dto.City;
        kyc.State = dto.State;
        kyc.Pincode = dto.Pincode;
        kyc.Country = dto.Country;

        kyc.BankName = dto.BankName;
        kyc.AccountNumber = dto.AccountNumber;
        kyc.IfscCode = dto.IfscCode;
        kyc.AccountType = dto.AccountType;
        kyc.DematAccountNumber = dto.DematAccountNumber;
        kyc.DpId = dto.DpId;

        kyc.NomineesJson = dto.NomineesJson;

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
