using backend.DTOs.Common;
using backend.DTOs.Irm;

namespace backend.Services.Interfaces;

public interface IKycService
{
    Task<ApiResponse<KycDto>> GetByInvestorIdAsync(int investorId, int companyId, CancellationToken ct = default);
    Task<ApiResponse<KycDto>> GetByIdAsync(int id, int companyId, CancellationToken ct = default);
    Task<ApiResponse<SendKycLinkResponseDto>> SendKycLinkAsync(int companyId, int irmId, SendKycLinkDto dto, CancellationToken ct = default);
    Task<ApiResponse<KycDto>> SubmitKycAsync(int companyId, SubmitKycDto dto, CancellationToken ct = default);
    Task<ApiResponse<KycDto>> ReviewKycAsync(int id, int companyId, KycReviewDto dto, CancellationToken ct = default);
    Task<ApiResponse<PublicKycDto>> GetByTokenAsync(string token, CancellationToken ct = default);
    Task<ApiResponse<KycDto>> GetByEmailAsync(string email, int companyId, CancellationToken ct = default);
    Task<ApiResponse<KycDto>> GetByPhoneAsync(string phone, int companyId, CancellationToken ct = default);
    Task<ApiResponse<List<KycListDto>>> GetAllAsync(int companyId, string? status, CancellationToken ct = default);
    Task<ApiResponse<List<KycListDto>>> GetAllAsync(int companyId, string? status, int? irmId, CancellationToken ct = default);
    Task<ApiResponse<KycDto>> SaveAssistedKycAsync(int companyId, int irmId, SubmitKycDto dto, CancellationToken ct = default);
    Task<ApiResponse<bool>> RevokeKycLinkAsync(int id, int companyId, int? irmId, CancellationToken ct = default);
    Task<ApiResponse<SendKycLinkResponseDto>> ResendKycLinkAsync(int id, int companyId, int irmId, ResendKycLinkDto? dto, CancellationToken ct = default);
}
