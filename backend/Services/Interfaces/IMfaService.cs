using backend.DTOs.Auth;
using backend.DTOs.Common;

namespace backend.Services.Interfaces;

public interface IMfaService
{
    Task<MfaStatusResponseDto> GetStatusAsync(int userId, CancellationToken ct = default);

    Task<ApiResponse<MfaSetupDto>> SetupAsync(int userId, string email, string? ipAddress, string? userAgent, CancellationToken ct = default);

    Task<ApiResponse<MfaVerifySetupResponseDto>> VerifySetupAsync(int userId, string code, string? ipAddress, string? userAgent, CancellationToken ct = default);

    Task<MfaChallengeResponseDto> CreateLoginChallengeAsync(int userId, string? ipAddress, string? userAgent, CancellationToken ct = default);

    Task<ApiResponse<LoginResponseDto>> VerifyLoginChallengeAsync(string challengeToken, string code, string ipAddress, string userAgent, CancellationToken ct = default);

    Task<ApiResponse<LoginResponseDto>> VerifyRecoveryLoginAsync(string challengeToken, string recoveryCode, string ipAddress, string userAgent, CancellationToken ct = default);

    Task<ApiResponse<bool>> DisableMfaAsync(int userId, string password, string? code, string? ipAddress, string? userAgent, CancellationToken ct = default);

    Task<ApiResponse<List<string>>> RegenerateRecoveryCodesAsync(int userId, string password, string? code, string? ipAddress, string? userAgent, CancellationToken ct = default);

    Task<bool> IsMfaRequiredAsync(int userId, CancellationToken ct = default);
}
