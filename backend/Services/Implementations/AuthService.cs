using backend.Authentication.Interfaces;
using System.Security.Cryptography;
using System.Text;
using backend.Configuration;
using backend.Data;
using backend.DTOs.Auth;
using backend.DTOs.Common;
using backend.DTOs.SuperAdmin;
using backend.Helpers;
using backend.Models.Entities;
using backend.Models.Enums;
using backend.Repositories.Interfaces;
using backend.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

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
    private readonly ITotpService _totpService;

    public AuthService(
        IUserRepository userRepository,
        IJwtService jwtService,
        ILogger<AuthService> logger,
        ApplicationDbContext context,
        ICurrentUserService currentUser,
        IEmailService emailService,
        IOptionsMonitor<SmtpSettings> smtpOptions,
        ITotpService totpService)
    {
        _userRepository = userRepository;
        _jwtService = jwtService;
        _logger = logger;
        _context = context;
        _currentUser = currentUser;
        _emailService = emailService;
        _smtpOptions = smtpOptions;
        _totpService = totpService;
    }

    public async Task<ApiResponse<LoginResponseDto>> LoginAsync(
        LoginRequestDto request,
        string ipAddress,
        string userAgent,
        CancellationToken cancellationToken = default)
    {
        var normalizedEmail = request.Email?.Trim().ToLowerInvariant() ?? string.Empty;
        var user = await _userRepository.GetByEmailAsync(normalizedEmail, cancellationToken);

        // Security practice: prevent email enumeration & verify password
        if (user == null || !PasswordHasher.VerifyPassword(request.Password, user.PasswordHash))
        {
            _logger.LogWarning("Failed login attempt for email: {Email} from IP: {Ip}", request.Email, ipAddress);
            _context.SecurityEvents.Add(new SecurityEvent
            {
                EventType = "LOGIN_FAILURE",
                Severity = "WARNING",
                Description = $"Failed login attempt for email: {request.Email}",
                IpAddress = string.IsNullOrWhiteSpace(ipAddress) ? "127.0.0.1" : ipAddress,
                UserEmail = request.Email,
                Timestamp = DateTime.UtcNow
            });
            await _context.SaveChangesAsync(cancellationToken);
            return ApiResponse<LoginResponseDto>.FailureResult("Invalid email or password.");
        }

        if (user.Status != UserStatus.Active)
        {
            _logger.LogWarning("Login attempt for non-active user: {Email}, Status: {Status}", request.Email, user.Status);
            return ApiResponse<LoginResponseDto>.FailureResult("Your account is currently not active. Please contact your administrator.");
        }

        if (user.Company != null && (!user.Company.IsActive || user.Company.Status == "Suspended"))
        {
            _logger.LogWarning("Login attempt for user with inactive organization: {Email}, Org: {OrgId}", request.Email, user.CompanyId);
            return ApiResponse<LoginResponseDto>.FailureResult("Your organization account is inactive or suspended.");
        }

        // Two-factor authentication challenge
        if (user.IsTwoFactorEnabled && !string.IsNullOrWhiteSpace(user.TwoFactorSecret))
        {
            var tempPayload = $"{user.Id}:{DateTime.UtcNow.AddMinutes(5).Ticks}:{Hash(user.PasswordHash + user.TwoFactorSecret)}";
            var tempToken = Convert.ToBase64String(Encoding.UTF8.GetBytes(tempPayload));

            _logger.LogInformation("2FA challenge required for user: {Email}", user.Email);
            return ApiResponse<LoginResponseDto>.SuccessResult(new LoginResponseDto
            {
                RequiresTwoFactor = true,
                TempToken = tempToken,
                User = null,
                Token = string.Empty
            }, "Two-factor authentication required. Please enter your 6-digit authenticator code.");
        }

        // Update last login timestamp
        await _userRepository.UpdateLastLoginAsync(user.Id, cancellationToken);

        // Generate JWT token with Jti details
        var (token, jti, _) = _jwtService.GenerateTokenWithDetails(user);

        // Create persistent UserSession
        var session = new UserSession
        {
            UserId = user.Id,
            TokenId = jti,
            IpAddress = string.IsNullOrWhiteSpace(ipAddress) ? "127.0.0.1" : ipAddress,
            UserAgent = string.IsNullOrWhiteSpace(userAgent) ? "Unknown" : userAgent,
            Device = DetectDevice(userAgent),
            Location = "India (IST)",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            LastActivityAt = DateTime.UtcNow
        };
        _context.UserSessions.Add(session);

        // Record security audit event
        _context.SecurityEvents.Add(new SecurityEvent
        {
            EventType = "LOGIN_SUCCESS",
            Severity = "INFO",
            Description = $"User {user.Email} logged in successfully.",
            IpAddress = session.IpAddress,
            UserEmail = user.Email,
            UserId = user.Id,
            Timestamp = DateTime.UtcNow
        });
        await _context.SaveChangesAsync(cancellationToken);

        var responseDto = new LoginResponseDto
        {
            Token = token,
            User = MapToUserDto(user),
            Tenant = user.Company != null ? MapToTenantDto(user.Company) : null,
            MustEnrollTwoFactor = user.RoleId == 1 && !user.IsTwoFactorEnabled
        };

        _logger.LogInformation("Successful login for user: {Email}", user.Email);
        return ApiResponse<LoginResponseDto>.SuccessResult(responseDto, "Login successful");
    }

    public async Task<ApiResponse<LoginResponseDto>> VerifyTwoFactorLoginAsync(
        TwoFactorLoginVerifyRequestDto request,
        string ipAddress,
        string userAgent,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.TempToken) || string.IsNullOrWhiteSpace(request.Code))
        {
            return ApiResponse<LoginResponseDto>.FailureResult("Temporary challenge token and verification code are required.");
        }

        int userId;
        try
        {
            var raw = Encoding.UTF8.GetString(Convert.FromBase64String(request.TempToken));
            var parts = raw.Split(':');
            if (parts.Length < 3) return ApiResponse<LoginResponseDto>.FailureResult("Invalid 2FA challenge token.");
            userId = int.Parse(parts[0]);
            var expiryTicks = long.Parse(parts[1]);
            if (DateTime.UtcNow.Ticks > expiryTicks)
            {
                return ApiResponse<LoginResponseDto>.FailureResult("2FA challenge session expired. Please log in again.");
            }
        }
        catch
        {
            return ApiResponse<LoginResponseDto>.FailureResult("Invalid 2FA challenge token.");
        }

        var user = await _context.Users
            .Include(u => u.Role)
            .Include(u => u.Company)
            .FirstOrDefaultAsync(u => u.Id == userId && u.Status == UserStatus.Active, cancellationToken);

        if (user == null || !user.IsTwoFactorEnabled || string.IsNullOrWhiteSpace(user.TwoFactorSecret))
        {
            return ApiResponse<LoginResponseDto>.FailureResult("2FA is not enabled or user account is not active.");
        }

        var cleanCode = request.Code.Trim().Replace(" ", "").Replace("-", "");
        var isTotpValid = _totpService.ValidateTotp(user.TwoFactorSecret, cleanCode);
        var isRecoveryUsed = false;

        if (!isTotpValid && !string.IsNullOrWhiteSpace(user.TwoFactorRecoveryCodesJson))
        {
            try
            {
                var codes = System.Text.Json.JsonSerializer.Deserialize<List<string>>(user.TwoFactorRecoveryCodesJson);
                if (codes != null && codes.Contains(cleanCode.ToUpperInvariant()))
                {
                    codes.Remove(cleanCode.ToUpperInvariant());
                    user.TwoFactorRecoveryCodesJson = System.Text.Json.JsonSerializer.Serialize(codes);
                    isRecoveryUsed = true;
                    isTotpValid = true;
                }
            }
            catch { }
        }

        if (!isTotpValid)
        {
            _context.SecurityEvents.Add(new SecurityEvent
            {
                EventType = "MFA_FAILURE",
                Severity = "WARNING",
                Description = $"Invalid 2FA verification attempt for user: {user.Email}",
                IpAddress = string.IsNullOrWhiteSpace(ipAddress) ? "127.0.0.1" : ipAddress,
                UserEmail = user.Email,
                UserId = user.Id,
                Timestamp = DateTime.UtcNow
            });
            await _context.SaveChangesAsync(cancellationToken);
            return ApiResponse<LoginResponseDto>.FailureResult("Invalid authentication code. Please check your authenticator app.");
        }

        // Generate JWT token with Jti details
        var (token, jti, _) = _jwtService.GenerateTokenWithDetails(user);

        // Create persistent UserSession
        var session = new UserSession
        {
            UserId = user.Id,
            TokenId = jti,
            IpAddress = string.IsNullOrWhiteSpace(ipAddress) ? "127.0.0.1" : ipAddress,
            UserAgent = string.IsNullOrWhiteSpace(userAgent) ? "Unknown" : userAgent,
            Device = DetectDevice(userAgent),
            Location = "India (IST)",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            LastActivityAt = DateTime.UtcNow
        };
        _context.UserSessions.Add(session);

        _context.SecurityEvents.Add(new SecurityEvent
        {
            EventType = isRecoveryUsed ? "LOGIN_SUCCESS_RECOVERY_CODE" : "LOGIN_SUCCESS_MFA",
            Severity = "INFO",
            Description = $"User {user.Email} authenticated successfully via {(isRecoveryUsed ? "Recovery Code" : "2FA TOTP")}.",
            IpAddress = session.IpAddress,
            UserEmail = user.Email,
            UserId = user.Id,
            Timestamp = DateTime.UtcNow
        });
        await _context.SaveChangesAsync(cancellationToken);

        var responseDto = new LoginResponseDto
        {
            Token = token,
            User = MapToUserDto(user),
            Tenant = user.Company != null ? MapToTenantDto(user.Company) : null
        };

        return ApiResponse<LoginResponseDto>.SuccessResult(responseDto, "Two-factor verification successful.");
    }

    public async Task<ApiResponse<object>> ChangePasswordAsync(ChangePasswordRequestDto request, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.CurrentPassword))
            return ApiResponse<object>.FailureResult("Current password is required.");

        if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 8)
            return ApiResponse<object>.FailureResult("New password must be at least 8 characters long.");

        if (request.NewPassword != request.ConfirmPassword)
            return ApiResponse<object>.FailureResult("New password and confirmation password do not match.");

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == _currentUser.UserId && u.Status == UserStatus.Active, cancellationToken);
        if (user == null)
            return ApiResponse<object>.FailureResult("User not found or account is inactive.");

        if (!PasswordHasher.VerifyPassword(request.CurrentPassword, user.PasswordHash))
            return ApiResponse<object>.FailureResult("Current password is incorrect.");

        user.PasswordHash = PasswordHasher.HashPassword(request.NewPassword);
        user.UpdatedAt = DateTime.UtcNow;

        // Invalidate all active sessions for this user
        var activeSessions = await _context.UserSessions
            .Where(s => s.UserId == user.Id && s.IsActive)
            .ToListAsync(cancellationToken);

        foreach (var s in activeSessions)
        {
            s.IsActive = false;
            s.RevokedAt = DateTime.UtcNow;
            s.RevokedReason = "Password changed by user";
        }

        _context.SecurityEvents.Add(new SecurityEvent
        {
            EventType = "PASSWORD_CHANGED",
            Severity = "INFO",
            Description = $"User {user.Email} updated their password. Revoked {activeSessions.Count} active sessions.",
            UserEmail = user.Email,
            UserId = user.Id,
            Timestamp = DateTime.UtcNow
        });

        _context.AuditLogs.Add(new AuditLog
        {
            Action = "CHANGE_PASSWORD",
            EntityType = "User",
            EntityId = user.Id.ToString(),
            CompanyId = user.CompanyId,
            ActorName = user.Name,
            ActorEmail = user.Email,
            Details = $"User changed account password. {activeSessions.Count} active sessions were revoked.",
            Module = "Security",
            Status = "success",
            Timestamp = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(cancellationToken);
        return ApiResponse<object>.SuccessResult(new { }, "Password updated successfully. All other active sessions have been revoked.");
    }

    public async Task<ApiResponse<string>> ForgotPasswordAsync(ForgotPasswordDto request, CancellationToken cancellationToken = default)
    {
        const string genericMessage = "If an account with that email exists, reset instructions have been sent to your email.";
        var normalizedEmail = request.Email?.Trim().ToLowerInvariant() ?? string.Empty;

        if (string.IsNullOrWhiteSpace(normalizedEmail))
        {
            return ApiResponse<string>.FailureResult("A valid email address is required.");
        }

        var user = await _context.Users
            .FirstOrDefaultAsync(x => x.Email.ToLower() == normalizedEmail && x.Status == UserStatus.Active, cancellationToken);

        if (user == null)
        {
            _logger.LogInformation("Password reset requested for unrecognized or inactive email: {Email}", normalizedEmail);
            return ApiResponse<string>.SuccessResult(string.Empty, genericMessage);
        }

        var pendingTokens = await _context.PasswordResetTokens
            .Where(t => t.UserId == user.Id && t.UsedAt == null)
            .ToListAsync(cancellationToken);
        foreach (var t in pendingTokens)
        {
            t.UsedAt = DateTime.UtcNow;
        }

        var rawToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();

        _context.PasswordResetTokens.Add(new PasswordResetToken
        {
            UserId = user.Id,
            TokenHash = Hash(rawToken),
            ExpiresAt = DateTime.UtcNow.AddMinutes(60),
            CreatedAt = DateTime.UtcNow
        });
        await _context.SaveChangesAsync(cancellationToken);

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

        _context.SecurityEvents.Add(new SecurityEvent
        {
            EventType = "PASSWORD_RESET_REQUESTED",
            Severity = "INFO",
            Description = $"Password reset requested for email {user.Email}.",
            UserEmail = user.Email,
            UserId = user.Id,
            Timestamp = DateTime.UtcNow
        });
        await _context.SaveChangesAsync(cancellationToken);

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

        var otherActiveTokens = await _context.PasswordResetTokens
            .Where(x => x.UserId == user.Id && x.UsedAt == null && x.Id != reset.Id)
            .ToListAsync(cancellationToken);
        foreach (var t in otherActiveTokens)
        {
            t.UsedAt = DateTime.UtcNow;
        }

        // Invalidate all active sessions for this user upon password reset
        var sessions = await _context.UserSessions
            .Where(s => s.UserId == user.Id && s.IsActive)
            .ToListAsync(cancellationToken);
        foreach (var s in sessions)
        {
            s.IsActive = false;
            s.RevokedAt = DateTime.UtcNow;
            s.RevokedReason = "Password reset completed";
        }

        _context.SecurityEvents.Add(new SecurityEvent
        {
            EventType = "PASSWORD_RESET_COMPLETED",
            Severity = "INFO",
            Description = $"Password reset completed for user {user.Email}. Active sessions revoked.",
            UserEmail = user.Email,
            UserId = user.Id,
            Timestamp = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(cancellationToken);
        _logger.LogInformation("Password reset successfully for user: {Email}", user.Email);

        return ApiResponse<object>.SuccessResult(new { }, "Password reset successful. You may now log in with your new password.");
    }

    public async Task<ApiResponse<LoginResponseDto>> GetCurrentUserAsync(CancellationToken cancellationToken = default)
    {
        var user = await _context.Users.Include(x => x.Role).Include(x => x.Company).FirstOrDefaultAsync(x => x.Id == _currentUser.UserId, cancellationToken);
        if (user == null || user.Status != UserStatus.Active) return ApiResponse<LoginResponseDto>.FailureResult("Your account has been suspended or is inactive.");
        return ApiResponse<LoginResponseDto>.SuccessResult(new LoginResponseDto { User = MapToUserDto(user), Tenant = user.Company == null ? null : MapToTenantDto(user.Company) }, "Current user loaded");
    }

    private static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

    private static string DetectDevice(string? userAgent)
    {
        if (string.IsNullOrWhiteSpace(userAgent)) return "Desktop / Web Browser";
        var ua = userAgent.ToLowerInvariant();
        if (ua.Contains("mobile") || ua.Contains("android") || ua.Contains("iphone")) return "Mobile Browser";
        if (ua.Contains("ipad") || ua.Contains("tablet")) return "Tablet";
        if (ua.Contains("windows")) return "Windows Desktop / Chrome / Edge";
        if (ua.Contains("macintosh") || ua.Contains("mac os")) return "macOS / Safari / Chrome";
        if (ua.Contains("linux")) return "Linux Desktop";
        return "Web Browser";
    }

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
