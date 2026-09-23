using backend.Authentication.Interfaces;
using System.Security.Cryptography;
using System.Text;
using backend.DTOs.Auth;
using backend.DTOs.Common;
using backend.Helpers;
using backend.Models.Entities;
using backend.Models.Enums;
using backend.Repositories.Interfaces;
using backend.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using backend.Data;

namespace backend.Services.Implementations;

public class AuthService : IAuthService
{
    private readonly IUserRepository _userRepository;
    private readonly IJwtService _jwtService;
    private readonly ILogger<AuthService> _logger;
    private readonly ApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public AuthService(
        IUserRepository userRepository,
        IJwtService jwtService,
        ILogger<AuthService> logger,
        ApplicationDbContext context,
        ICurrentUserService currentUser)
    {
        _userRepository = userRepository;
        _jwtService = jwtService;
        _logger = logger;
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<ApiResponse<LoginResponseDto>> LoginAsync(LoginRequestDto request, CancellationToken cancellationToken = default)
    {
        var user = await _userRepository.GetByEmailAsync(request.Email, cancellationToken);

        // Security practice: use constant-time dummy verification or generic failure message to prevent email enumeration
        if (user == null || user.CompanyId != 1 || user.Role.Code != "sales_executive" || !PasswordHasher.VerifyPassword(request.Password, user.PasswordHash))
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
        var user = await _context.Users.Include(x => x.Role).Include(x => x.Company).FirstOrDefaultAsync(x => x.Email.ToLower() == request.Email.Trim().ToLower() && x.CompanyId == 1 && x.Role.Code == "sales_executive", cancellationToken);
        if (user == null) return ApiResponse<string>.SuccessResult(string.Empty, "If the account exists, reset instructions have been generated.");
        var rawToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        _context.Set<PasswordResetToken>().Add(new PasswordResetToken { UserId = user.Id, TokenHash = Hash(rawToken), ExpiresAt = DateTime.UtcNow.AddHours(1) });
        await _context.SaveChangesAsync(cancellationToken);
        return ApiResponse<string>.SuccessResult(rawToken, "Password reset token generated.");
    }

    public async Task<ApiResponse<object>> ResetPasswordAsync(ResetPasswordDto request, CancellationToken cancellationToken = default)
    {
        var reset = await _context.Set<PasswordResetToken>().FirstOrDefaultAsync(x => x.TokenHash == Hash(request.Token) && x.UsedAt == null && x.ExpiresAt > DateTime.UtcNow, cancellationToken);
        if (reset == null) return ApiResponse<object>.FailureResult("Invalid or expired reset token.");
        var user = await _context.Users.FirstOrDefaultAsync(x => x.Id == reset.UserId && x.CompanyId == 1, cancellationToken);
        if (user == null) return ApiResponse<object>.FailureResult("Invalid reset request.");
        user.PasswordHash = PasswordHasher.HashPassword(request.NewPassword); reset.UsedAt = DateTime.UtcNow; await _context.SaveChangesAsync(cancellationToken);
        return ApiResponse<object>.SuccessResult(new { }, "Password reset successful.");
    }

    public async Task<ApiResponse<LoginResponseDto>> GetCurrentUserAsync(CancellationToken cancellationToken = default)
    {
        var user = await _context.Users.Include(x => x.Role).Include(x => x.Company).FirstOrDefaultAsync(x => x.Id == _currentUser.UserId && x.CompanyId == _currentUser.CompanyId && x.Role.Code == "sales_executive", cancellationToken);
        if (user == null) return ApiResponse<LoginResponseDto>.FailureResult("Sales executive profile not found.");
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
