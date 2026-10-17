using backend.DTOs.Auth;
using backend.DTOs.Common;
using backend.DTOs.SuperAdmin;

namespace backend.Services.Interfaces;

public interface IAuthService
{
    Task<ApiResponse<LoginResponseDto>> LoginAsync(LoginRequestDto request, string ipAddress, string userAgent, CancellationToken cancellationToken = default);
    Task<ApiResponse<LoginResponseDto>> VerifyTwoFactorLoginAsync(TwoFactorLoginVerifyRequestDto request, string ipAddress, string userAgent, CancellationToken cancellationToken = default);
    Task<ApiResponse<string>> ForgotPasswordAsync(ForgotPasswordDto request, CancellationToken cancellationToken = default);
    Task<ApiResponse<object>> ResetPasswordAsync(ResetPasswordDto request, CancellationToken cancellationToken = default);
    Task<ApiResponse<object>> ChangePasswordAsync(ChangePasswordRequestDto request, CancellationToken cancellationToken = default);
    Task<ApiResponse<LoginResponseDto>> GetCurrentUserAsync(CancellationToken cancellationToken = default);
}
