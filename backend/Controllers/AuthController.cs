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

    public AuthController(IAuthService authService, IValidator<LoginRequestDto> loginValidator, IValidator<ForgotPasswordDto> forgotValidator, IValidator<ResetPasswordDto> resetValidator)
    {
        _authService = authService;
        _loginValidator = loginValidator;
        _forgotValidator = forgotValidator;
        _resetValidator = resetValidator;
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
    [Authorize(Roles = "sales_executive")]
    public async Task<IActionResult> Me(CancellationToken cancellationToken) => Ok(await _authService.GetCurrentUserAsync(cancellationToken));
}
