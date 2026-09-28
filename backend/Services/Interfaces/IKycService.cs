using backend.DTOs.Common;
using backend.DTOs.Kyc;
using Microsoft.AspNetCore.Http;

namespace backend.Services.Interfaces;

public interface IKycService
{
    Task<ApiResponse<CustomerKycResponseDto>> GetCustomerKycAsync(int customerId, CancellationToken ct);
    Task<ApiResponse<CustomerKycResponseDto>> SubmitOrUpdateKycAsync(int customerId, SubmitCustomerKycDto dto, CancellationToken ct);
    Task<ApiResponse<CustomerKycResponseDto>> VerifyKycAsync(int kycId, VerifyKycDto dto, CancellationToken ct);
    Task<ApiResponse<PagedResult<KycQueueItemDto>>> GetKycQueueAsync(string? status, string? search, int page, int pageSize, CancellationToken ct);
    
    Task<ApiResponse<KycDocumentResponseDto>> UploadDocumentAsync(int customerId, IFormFile file, string category, string? documentName, CancellationToken ct);
    Task<ApiResponse<List<KycDocumentResponseDto>>> GetCustomerDocumentsAsync(int customerId, string? category, CancellationToken ct);
    Task<(byte[] FileBytes, string ContentType, string FileName)?> GetDocumentDownloadAsync(int documentId, CancellationToken ct);
    Task<ApiResponse<bool>> DeleteDocumentAsync(int documentId, CancellationToken ct);
}
