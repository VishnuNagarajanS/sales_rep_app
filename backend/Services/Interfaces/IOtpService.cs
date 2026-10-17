using backend.DTOs.Common;
using backend.DTOs.Irm;

namespace backend.Services.Interfaces;

public interface IOtpService
{
    Task<ApiResponse<SendKycOtpResponseDto>> SendKycOtpAsync(SendKycOtpRequestDto dto, CancellationToken ct = default);
    Task<ApiResponse<VerifyKycOtpResponseDto>> VerifyKycOtpAsync(VerifyKycOtpRequestDto dto, CancellationToken ct = default);
    Task<bool> HasVerifiedOtpAsync(string token, string? email, CancellationToken ct = default);
    Task InvalidateOtpAsync(string token, string? email, CancellationToken ct = default);
}
