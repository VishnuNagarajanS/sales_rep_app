using backend.DTOs.Auth;
using backend.DTOs.Common;
using backend.Services.Interfaces;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly IValidator<LoginRequestDto> _loginValidator;
    private readonly IValidator<ForgotPasswordDto> _forgotValidator;
    private readonly IValidator<ResetPasswordDto> _resetValidator;
    private readonly backend.Data.ApplicationDbContext _dbContext;

    public AuthController(
        IAuthService authService,
        IValidator<LoginRequestDto> loginValidator,
        IValidator<ForgotPasswordDto> forgotValidator,
        IValidator<ResetPasswordDto> resetValidator,
        backend.Data.ApplicationDbContext dbContext)
    {
        _authService = authService;
        _loginValidator = loginValidator;
        _forgotValidator = forgotValidator;
        _resetValidator = resetValidator;
        _dbContext = dbContext;
    }

    /// <summary>
    /// Authenticates a user with email and password, returning a JWT token and user profile.
    /// </summary>
    /// <param name="request">The login credentials</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>JWT token, user profile, and tenant configuration</returns>
    [HttpPost("login")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ApiResponse<LoginResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<LoginResponseDto>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<LoginResponseDto>), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse<LoginResponseDto>), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Login([FromBody] LoginRequestDto request, CancellationToken cancellationToken)
    {
        var validationResult = await _loginValidator.ValidateAsync(request, cancellationToken);
        if (!validationResult.IsValid)
        {
            var errors = validationResult.Errors.Select(e => e.ErrorMessage).ToList();
            return BadRequest(ApiResponse<LoginResponseDto>.FailureResult("Validation failed", errors));
        }

        var result = await _authService.LoginAsync(request, cancellationToken);

        if (!result.Success)
        {
            return Unauthorized(result);
        }

        // Enforce Platform Maintenance Mode for non-Super-Admin users
        var userRole = result.Data?.User?.Role?.Code?.ToLowerInvariant();
        if (userRole != "super_admin")
        {
            var maintSetting = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstOrDefaultAsync(
                _dbContext.PlatformSettings,
                s => s.Key == "maintenance_mode",
                cancellationToken);

            if (maintSetting != null && !string.IsNullOrWhiteSpace(maintSetting.Value))
            {
                try
                {
                    var maint = System.Text.Json.JsonSerializer.Deserialize<backend.DTOs.SuperAdmin.MaintenanceModeDto>(
                        maintSetting.Value,
                        new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                    if (maint != null && maint.Enabled)
                    {
                        var bypassHeader = Request.Headers["X-Maintenance-Bypass"].ToString();
                        if (string.IsNullOrWhiteSpace(bypassHeader) || bypassHeader != maint.BypassSecret)
                        {
                            var msg = string.IsNullOrWhiteSpace(maint.Message)
                                ? "Platform is currently under scheduled maintenance. Please check back shortly."
                                : maint.Message;
                            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<LoginResponseDto>.FailureResult(msg));
                        }
                    }
                }
                catch { }
            }
        }

        return Ok(result);
    }

    [HttpPost("forgot-password")]
    [AllowAnonymous]
    public async Task<IActionResult> ForgotPassword(ForgotPasswordDto request, CancellationToken cancellationToken)
    {
        var validation = await _forgotValidator.ValidateAsync(request, cancellationToken);
        if (!validation.IsValid) return BadRequest(ApiResponse<string>.FailureResult("Validation failed", validation.Errors.Select(x => x.ErrorMessage).ToList()));
        return Ok(await _authService.ForgotPasswordAsync(request, cancellationToken));
    }

    [HttpPost("reset-password")]
    [AllowAnonymous]
    public async Task<IActionResult> ResetPassword(ResetPasswordDto request, CancellationToken cancellationToken)
    {
        var validation = await _resetValidator.ValidateAsync(request, cancellationToken);
        if (!validation.IsValid) return BadRequest(ApiResponse<object>.FailureResult("Validation failed", validation.Errors.Select(x => x.ErrorMessage).ToList()));
        var result = await _authService.ResetPasswordAsync(request, cancellationToken);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me(CancellationToken cancellationToken)
    {
        var result = await _authService.GetCurrentUserAsync(cancellationToken);
        if (!result.Success)
        {
            return Unauthorized(result);
        }
        return Ok(result);
    }
}
