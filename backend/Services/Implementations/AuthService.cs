using backend.Authentication.Interfaces;
using System.Security.Cryptography;
using System.Text;
using backend.Configuration;
using backend.DTOs.Auth;
using backend.DTOs.Common;
using backend.Helpers;
using backend.Models.Entities;
using backend.Models.Enums;
using backend.Repositories.Interfaces;
using backend.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using backend.Data;

namespace backend.Services.Implementations;

public class AuthService : IAuthService
{
    private readonly IUserRepository _userRepository;
    private readonly IJwtService _jwtService;
    private readonly ILogger<AuthService> _logger;
    private readonly ApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;
    private readonly IEmailService _emailService;
    private readonly IOptionsMonitor<SmtpSettings> _smtpOptions;

    public AuthService(
        IUserRepository userRepository,
        IJwtService jwtService,
        ILogger<AuthService> logger,
        ApplicationDbContext context,
        ICurrentUserService currentUser,
        IEmailService emailService,
        IOptionsMonitor<SmtpSettings> smtpOptions)
    {
        _userRepository = userRepository;
        _jwtService = jwtService;
        _logger = logger;
        _context = context;
        _currentUser = currentUser;
        _emailService = emailService;
        _smtpOptions = smtpOptions;
    }

    public async Task<ApiResponse<LoginResponseDto>> LoginAsync(LoginRequestDto request, CancellationToken cancellationToken = default)
    {
        var normalizedEmail = request.Email?.Trim().ToLowerInvariant() ?? string.Empty;
        var user = await _userRepository.GetByEmailAsync(normalizedEmail, cancellationToken);

        // Security practice: use constant-time dummy verification or generic failure message to prevent email enumeration
        if (user == null || !PasswordHasher.VerifyPassword(request.Password, user.PasswordHash))
        {
            _logger.LogWarning("Failed login attempt for email: {Email}", request.Email);
            return ApiResponse<LoginResponseDto>.FailureResult("Invalid email or password.");
        }

        if (user.Status != UserStatus.Active)
        {
            _logger.LogWarning("Login attempt for non-active user: {Email}, Status: {Status}", request.Email, user.Status);
            return ApiResponse<LoginResponseDto>.FailureResult("Your account is currently not active. Please contact your administrator.");
        }

        if (user.Company != null && !user.Company.IsActive)
        {
            _logger.LogWarning("Login attempt for user with inactive organization: {Email}, Org: {OrgId}", request.Email, user.CompanyId);
            return ApiResponse<LoginResponseDto>.FailureResult("Your organization account is inactive.");
        }

        // Update last login timestamp
        await _userRepository.UpdateLastLoginAsync(user.Id, cancellationToken);

        // Generate JWT token
        var token = _jwtService.GenerateToken(user);

        // Map to Response DTO
        var responseDto = new LoginResponseDto
        {
            Token = token,
            User = MapToUserDto(user),
            Tenant = user.Company != null ? MapToTenantDto(user.Company) : null
        };

        _logger.LogInformation("Successful login for user: {Email}", user.Email);
        return ApiResponse<LoginResponseDto>.SuccessResult(responseDto, "Login successful");
    }

    public async Task<ApiResponse<string>> ForgotPasswordAsync(ForgotPasswordDto request, CancellationToken cancellationToken = default)
    {
        const string genericMessage = "If an account with that email exists, reset instructions have been sent to your email.";
        var normalizedEmail = request.Email?.Trim().ToLowerInvariant() ?? string.Empty;

        if (string.IsNullOrWhiteSpace(normalizedEmail))
        {
            return ApiResponse<string>.FailureResult("A valid email address is required.");
        }

        // Query active user across any tenant / role
        var user = await _context.Users
            .FirstOrDefaultAsync(x => x.Email.ToLower() == normalizedEmail && x.Status == UserStatus.Active, cancellationToken);

        if (user == null)
        {
            _logger.LogInformation("Password reset requested for unrecognized or inactive email: {Email}", normalizedEmail);
            return ApiResponse<string>.SuccessResult(string.Empty, genericMessage);
        }

        // Invalidate any existing unused reset tokens for this user
        var pendingTokens = await _context.PasswordResetTokens
            .Where(t => t.UserId == user.Id && t.UsedAt == null)
            .ToListAsync(cancellationToken);
        foreach (var t in pendingTokens)
        {
            t.UsedAt = DateTime.UtcNow;
        }

        // Generate 32-byte cryptographically secure random token in URL-safe hex
        var rawToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();

        _context.PasswordResetTokens.Add(new PasswordResetToken
        {
            UserId = user.Id,
            TokenHash = Hash(rawToken),
            ExpiresAt = DateTime.UtcNow.AddMinutes(60),
            CreatedAt = DateTime.UtcNow
        });
        await _context.SaveChangesAsync(cancellationToken);

        // Build reset link using configured ClientBaseUrl
        var clientBaseUrl = !string.IsNullOrWhiteSpace(_smtpOptions.CurrentValue.ClientBaseUrl)
            ? _smtpOptions.CurrentValue.ClientBaseUrl.TrimEnd('/')
            : "http://localhost:5173";

        var resetLink = $"{clientBaseUrl}/reset-password?token={Uri.EscapeDataString(rawToken)}";

        _logger.LogInformation("Dispatching password reset email to {Email}...", user.Email);
        var emailSent = await _emailService.SendPasswordResetEmailAsync(
            user.Email,
            user.Name,
            resetLink,
            60,
            cancellationToken);

        if (!emailSent)
        {
            _logger.LogWarning("Failed to deliver password reset email to {Email}: {Error}", user.Email, _emailService.LastError);
        }

        return ApiResponse<string>.SuccessResult(string.Empty, genericMessage);
    }

    public async Task<ApiResponse<object>> ResetPasswordAsync(ResetPasswordDto request, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Token))
        {
            return ApiResponse<object>.FailureResult("Reset token is required.");
        }

        if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 8)
        {
            return ApiResponse<object>.FailureResult("New password must be at least 8 characters long.");
        }

        var tokenHash = Hash(request.Token.Trim());
        var reset = await _context.PasswordResetTokens
            .FirstOrDefaultAsync(x => x.TokenHash == tokenHash && x.UsedAt == null && x.ExpiresAt > DateTime.UtcNow, cancellationToken);

        if (reset == null)
        {
            return ApiResponse<object>.FailureResult("Invalid or expired reset token.");
        }

        var user = await _context.Users.FirstOrDefaultAsync(x => x.Id == reset.UserId && x.Status == UserStatus.Active, cancellationToken);
        if (user == null)
        {
            return ApiResponse<object>.FailureResult("User account not found or is currently inactive.");
        }

        user.PasswordHash = PasswordHasher.HashPassword(request.NewPassword);
        user.UpdatedAt = DateTime.UtcNow;
        reset.UsedAt = DateTime.UtcNow;

        // Invalidate any other active tokens for this user
        var otherActiveTokens = await _context.PasswordResetTokens
            .Where(x => x.UserId == user.Id && x.UsedAt == null && x.Id != reset.Id)
            .ToListAsync(cancellationToken);
        foreach (var t in otherActiveTokens)
        {
            t.UsedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync(cancellationToken);
        _logger.LogInformation("Password reset successfully for user: {Email}", user.Email);

        return ApiResponse<object>.SuccessResult(new { }, "Password reset successful. You may now log in with your new password.");
    }

    public async Task<ApiResponse<LoginResponseDto>> GetCurrentUserAsync(CancellationToken cancellationToken = default)
    {
        var user = await _context.Users.Include(x => x.Role).Include(x => x.Company).FirstOrDefaultAsync(x => x.Id == _currentUser.UserId, cancellationToken);
        if (user == null) return ApiResponse<LoginResponseDto>.FailureResult("User profile not found.");
        return ApiResponse<LoginResponseDto>.SuccessResult(new LoginResponseDto { User = MapToUserDto(user), Tenant = user.Company == null ? null : MapToTenantDto(user.Company) }, "Current user loaded");
    }

    private static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

    private static UserDto MapToUserDto(User user)
    {
        return new UserDto
        {
            Id = user.Id.ToString(),
            Name = user.Name,
            Email = user.Email,
            Phone = user.Phone,
            Role = new RoleDto
            {
                Id = user.Role.Id.ToString(),
                Name = user.Role.Name,
                Code = user.Role.Code,
                Permissions = user.Role.Permissions
            },
            CompanyId = user.CompanyId?.ToString(),
            CompanySlug = user.Company?.Slug,
            CompanyName = user.Company?.Name,
            Status = user.Status.ToString(),
            LastLogin = "Just now",
            Avatar = user.AvatarUrl
        };
    }

    private static TenantDto MapToTenantDto(Tenant tenant)
    {
        return new TenantDto
        {
            Id = tenant.Id.ToString(),
            Name = tenant.Name,
            Slug = tenant.Slug,
            BrandColor = tenant.BrandColor,
            Logo = tenant.Logo,
            Tagline = tenant.Tagline,
            EnabledFeatures = tenant.EnabledFeatures,
            Timezone = tenant.Timezone,
            Currency = tenant.Currency,
            BusinessHours = tenant.BusinessHours
        };
    }
}
