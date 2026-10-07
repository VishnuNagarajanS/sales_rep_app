using System.Security.Claims;
using backend.Authentication.Interfaces;
using backend.DTOs.Auth;
using backend.DTOs.Common;
using backend.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/auth/mfa")]
public class MfaController : ControllerBase
{
    private readonly IMfaService _mfaService;
    private readonly ICurrentUserService _currentUser;
    private readonly ILogger<MfaController> _logger;

    public MfaController(
        IMfaService mfaService,
        ICurrentUserService currentUser,
        ILogger<MfaController> logger)
    {
        _mfaService = mfaService;
        _currentUser = currentUser;
        _logger = logger;
    }

    /// <summary>
    /// Gets the current MFA enrollment and status for the authenticated user.
    /// Never returns secrets, recovery codes, or hashes.
    /// </summary>
    [HttpGet("status")]
    [Authorize]
    [ProducesResponseType(typeof(ApiResponse<MfaStatusResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<ApiResponse<MfaStatusResponseDto>>> GetStatus(CancellationToken ct = default)
    {
        var userId = GetCurrentUserId();
        if (userId <= 0) return Unauthorized(ApiResponse<MfaStatusResponseDto>.FailureResult("User not authenticated."));

        var status = await _mfaService.GetStatusAsync(userId, ct);
        return Ok(ApiResponse<MfaStatusResponseDto>.SuccessResult(status));
    }

    /// <summary>
    /// Initiates RFC 6238 TOTP setup by generating a secret and otpauth URI.
    /// The secret is securely encrypted at rest and not yet enabled until verified.
    /// </summary>
    [HttpPost("setup")]
    [Authorize]
    [ProducesResponseType(typeof(ApiResponse<MfaSetupDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ApiResponse<MfaSetupDto>>> Setup(CancellationToken ct = default)
    {
        var userId = GetCurrentUserId();
        if (userId <= 0) return Unauthorized(ApiResponse<MfaSetupDto>.FailureResult("User not authenticated."));

        var (ip, ua) = GetClientInfo();
        var email = _currentUser.Email ?? User.FindFirst(ClaimTypes.Email)?.Value ?? string.Empty;

        var result = await _mfaService.SetupAsync(userId, email, ip, ua, ct);
        if (!result.Success) return BadRequest(result);

        return Ok(result);
    }

    /// <summary>
    /// Verifies the pending TOTP enrollment code and activates MFA.
    /// Returns plain backup recovery codes exactly once.
    /// </summary>
    [HttpPost("verify-setup")]
    [Authorize]
    [ProducesResponseType(typeof(ApiResponse<MfaVerifySetupResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ApiResponse<MfaVerifySetupResponseDto>>> VerifySetup(
        [FromBody] MfaVerifySetupRequestDto request,
        CancellationToken ct = default)
    {
        var userId = GetCurrentUserId();
        if (userId <= 0) return Unauthorized(ApiResponse<MfaVerifySetupResponseDto>.FailureResult("User not authenticated."));

        if (string.IsNullOrWhiteSpace(request?.Code))
        {
            return BadRequest(ApiResponse<MfaVerifySetupResponseDto>.FailureResult("6-digit TOTP verification code is required."));
        }

        var (ip, ua) = GetClientInfo();
        var result = await _mfaService.VerifySetupAsync(userId, request.Code, ip, ua, ct);
        if (!result.Success) return BadRequest(result);

        return Ok(result);
    }

    /// <summary>
    /// Verifies a login challenge using a 6-digit TOTP code.
    /// Issues the final authenticated JWT only upon successful verification.
    /// </summary>
    [HttpPost("verify")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ApiResponse<LoginResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<ApiResponse<LoginResponseDto>>> VerifyLogin(
        [FromBody] MfaLoginVerifyRequestDto request,
        CancellationToken ct = default)
    {
        var token = request.GetToken();
        if (string.IsNullOrWhiteSpace(token) || string.IsNullOrWhiteSpace(request.Code))
        {
            return BadRequest(ApiResponse<LoginResponseDto>.FailureResult("Challenge token and verification code are required."));
        }

        var (ip, ua) = GetClientInfo();
        var result = await _mfaService.VerifyLoginChallengeAsync(token, request.Code, ip, ua, ct);
        if (!result.Success)
        {
            return Unauthorized(result);
        }

        return Ok(result);
    }

    /// <summary>
    /// Verifies a login challenge using a single-use backup recovery code.
    /// Issues the final authenticated JWT upon valid recovery code.
    /// </summary>
    [HttpPost("recovery")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ApiResponse<LoginResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<ApiResponse<LoginResponseDto>>> VerifyRecoveryLogin(
        [FromBody] MfaRecoveryLoginRequestDto request,
        CancellationToken ct = default)
    {
        var token = request.GetToken();
        if (string.IsNullOrWhiteSpace(token) || string.IsNullOrWhiteSpace(request.RecoveryCode))
        {
            return BadRequest(ApiResponse<LoginResponseDto>.FailureResult("Challenge token and recovery code are required."));
        }

        var (ip, ua) = GetClientInfo();
        var result = await _mfaService.VerifyRecoveryLoginAsync(token, request.RecoveryCode, ip, ua, ct);
        if (!result.Success)
        {
            return Unauthorized(result);
        }

        return Ok(result);
    }

    /// <summary>
    /// Disables MFA for the authenticated user.
    /// Requires password confirmation and optionally current TOTP or recovery code.
    /// </summary>
    [HttpPost("disable")]
    [Authorize]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ApiResponse<bool>>> Disable(
        [FromBody] MfaDisableRequestDto request,
        CancellationToken ct = default)
    {
        var userId = GetCurrentUserId();
        if (userId <= 0) return Unauthorized(ApiResponse<bool>.FailureResult("User not authenticated."));

        if (string.IsNullOrWhiteSpace(request?.Password))
        {
            return BadRequest(ApiResponse<bool>.FailureResult("Current account password is required to disable MFA."));
        }

        var (ip, ua) = GetClientInfo();
        var result = await _mfaService.DisableMfaAsync(userId, request.Password, request.Code, ip, ua, ct);
        if (!result.Success) return BadRequest(result);

        return Ok(result);
    }

    /// <summary>
    /// Regenerates backup recovery codes, invalidating all prior codes.
    /// Requires current account password.
    /// </summary>
    [HttpPost("recovery-codes/regenerate")]
    [Authorize]
    [ProducesResponseType(typeof(ApiResponse<List<string>>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ApiResponse<List<string>>>> RegenerateRecoveryCodes(
        [FromBody] MfaRegenerateCodesRequestDto request,
        CancellationToken ct = default)
    {
        var userId = GetCurrentUserId();
        if (userId <= 0) return Unauthorized(ApiResponse<List<string>>.FailureResult("User not authenticated."));

        if (string.IsNullOrWhiteSpace(request?.Password))
        {
            return BadRequest(ApiResponse<List<string>>.FailureResult("Current account password is required to regenerate recovery codes."));
        }

        var (ip, ua) = GetClientInfo();
        var result = await _mfaService.RegenerateRecoveryCodesAsync(userId, request.Password, request.Code, ip, ua, ct);
        if (!result.Success) return BadRequest(result);

        return Ok(result);
    }

    private int GetCurrentUserId()
    {
        if (_currentUser.UserId.HasValue && _currentUser.UserId.Value > 0) return _currentUser.UserId.Value;
        var sub = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("userId")?.Value;
        return int.TryParse(sub, out var id) ? id : 0;
    }

    private (string ip, string ua) GetClientInfo()
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString()
                 ?? Request.Headers["X-Forwarded-For"].FirstOrDefault()
                 ?? "127.0.0.1";
        var ua = Request.Headers["User-Agent"].ToString();
        return (ip, ua);
    }
}
