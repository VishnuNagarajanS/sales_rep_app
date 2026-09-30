using backend.DTOs.Auth;
using backend.DTOs.Common;

namespace backend.Services.Interfaces;

public interface IAuthService
{
    Task<ApiResponse<LoginResponseDto>> LoginAsync(LoginRequestDto request, CancellationToken cancellationToken = default);
    Task<ApiResponse<string>> ForgotPasswordAsync(ForgotPasswordDto request, CancellationToken cancellationToken = default);
    Task<ApiResponse<object>> ResetPasswordAsync(ResetPasswordDto request, CancellationToken cancellationToken = default);
    Task<ApiResponse<LoginResponseDto>> GetCurrentUserAsync(CancellationToken cancellationToken = default);
}
