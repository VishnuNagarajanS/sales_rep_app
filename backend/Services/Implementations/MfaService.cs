using System.Security.Cryptography;
using System.Text;
using backend.Authentication.Interfaces;
using backend.Data;
using backend.DTOs.Auth;
using backend.DTOs.Common;
using backend.Helpers;
using backend.Models.Entities;
using backend.Models.Enums;
using backend.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace backend.Services.Implementations;

public class MfaService : IMfaService
{
    private const int MaxFailedAttempts = 5;
    private const int LockoutDurationMinutes = 5;
    private const int ChallengeExpiryMinutes = 5;
    private const int RecoveryCodeCount = 8;

    private readonly ApplicationDbContext _context;
    private readonly ITotpService _totpService;
    private readonly IMfaEncryptionService _encryptionService;
    private readonly IJwtService _jwtService;
    private readonly ILogger<MfaService> _logger;

    public MfaService(
        ApplicationDbContext context,
        ITotpService totpService,
        IMfaEncryptionService encryptionService,
        IJwtService jwtService,
        ILogger<MfaService> logger)
    {
        _context = context;
        _totpService = totpService;
        _encryptionService = encryptionService;
        _jwtService = jwtService;
        _logger = logger;
    }

    public async Task<bool> IsMfaRequiredAsync(int userId, CancellationToken ct = default)
    {
        var setting = await _context.UserMfaSettings.AsNoTracking().FirstOrDefaultAsync(s => s.UserId == userId, ct);
        if (setting != null)
        {
            return setting.IsEnabled && !string.IsNullOrWhiteSpace(setting.SecretEncrypted);
        }

        // Check legacy column if setting record doesn't exist yet
        var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
        return user != null && user.IsTwoFactorEnabled && !string.IsNullOrWhiteSpace(user.TwoFactorSecret);
    }

    public async Task<MfaStatusResponseDto> GetStatusAsync(int userId, CancellationToken ct = default)
    {
        var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user == null)
        {
            return new MfaStatusResponseDto
            {
                IsTwoFactorEnabled = false,
                RemainingRecoveryCodes = 0,
                UserEmail = string.Empty
            };
        }

        var setting = await _context.UserMfaSettings.AsNoTracking().FirstOrDefaultAsync(s => s.UserId == userId, ct);
        var isEnabled = setting != null ? setting.IsEnabled : user.IsTwoFactorEnabled;
        var enabledAt = setting?.EnabledAt;

        var recoveryCount = await _context.MfaRecoveryCodes
            .AsNoTracking()
            .CountAsync(c => c.UserId == userId && c.UsedAt == null, ct);

        // Fallback for legacy JSON codes if not yet migrated
        if (recoveryCount == 0 && !string.IsNullOrWhiteSpace(user.TwoFactorRecoveryCodesJson))
        {
            try
            {
                var codes = System.Text.Json.JsonSerializer.Deserialize<List<string>>(user.TwoFactorRecoveryCodesJson);
                recoveryCount = codes?.Count ?? 0;
            }
            catch { }
        }

        return new MfaStatusResponseDto
        {
            IsTwoFactorEnabled = isEnabled,
            EnabledAt = enabledAt,
            RemainingRecoveryCodes = recoveryCount,
            UserEmail = user.Email
        };
    }

    public async Task<ApiResponse<MfaSetupDto>> SetupAsync(
        int userId,
        string email,
        string? ipAddress,
        string? userAgent,
        CancellationToken ct = default)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user == null)
        {
            return ApiResponse<MfaSetupDto>.FailureResult("User account not found.");
        }

        // 1. Generate standard RFC 6238 Base32 secret
        var plainSecret = _totpService.GenerateSecret();
        var qrCodeUri = _totpService.GenerateQrCodeUri(user.Email, plainSecret, "NexusSales Platform");

        // 2. Encrypt secret at rest before persisting
        var encryptedSecret = _encryptionService.EncryptSecret(plainSecret);

        var setting = await _context.UserMfaSettings.FirstOrDefaultAsync(s => s.UserId == userId, ct);
        if (setting == null)
        {
            setting = new UserMfaSetting
            {
                UserId = userId,
                IsEnabled = false,
                SecretEncrypted = string.Empty,
                PendingSecretEncrypted = encryptedSecret,
                CreatedAt = DateTime.UtcNow
            };
            _context.UserMfaSettings.Add(setting);
        }
        else
        {
            setting.PendingSecretEncrypted = encryptedSecret;
            setting.UpdatedAt = DateTime.UtcNow;
        }

        // Clear legacy plaintext storage to avoid security exposure
        user.TwoFactorSecret = null;

        await LogSecurityEventAsync(userId, user.Email, "MFA_SETUP_STARTED", "info",
            "MFA enrollment session initiated. Awaiting TOTP code confirmation.", ipAddress, userAgent);

        await _context.SaveChangesAsync(ct);

        var dto = new MfaSetupDto
        {
            Secret = plainSecret,
            QrCodeUri = qrCodeUri,
            ManualEntryKey = plainSecret,
            RecoveryCodes = new List<string>() // Recovery codes generated upon verification
        };

        return ApiResponse<MfaSetupDto>.SuccessResult(dto, "MFA enrollment started. Scan the QR code or enter the key in your authenticator app.");
    }

    public async Task<ApiResponse<MfaVerifySetupResponseDto>> VerifySetupAsync(
        int userId,
        string code,
        string? ipAddress,
        string? userAgent,
        CancellationToken ct = default)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user == null)
        {
            return ApiResponse<MfaVerifySetupResponseDto>.FailureResult("User account not found.");
        }

        var setting = await _context.UserMfaSettings.FirstOrDefaultAsync(s => s.UserId == userId, ct);
        if (setting == null || string.IsNullOrWhiteSpace(setting.PendingSecretEncrypted))
        {
            return ApiResponse<MfaVerifySetupResponseDto>.FailureResult("MFA setup was not initiated. Please begin enrollment first.");
        }

        // Check lockout
        if (setting.LockedUntil.HasValue && setting.LockedUntil.Value > DateTime.UtcNow)
        {
            var remaining = Math.Ceiling((setting.LockedUntil.Value - DateTime.UtcNow).TotalMinutes);
            return ApiResponse<MfaVerifySetupResponseDto>.FailureResult($"Too many failed verification attempts. Please wait {remaining} minutes before trying again.");
        }

        string plainSecret;
        try
        {
            plainSecret = _encryptionService.DecryptSecret(setting.PendingSecretEncrypted);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to decrypt pending MFA secret for user {UserId}", userId);
            return ApiResponse<MfaVerifySetupResponseDto>.FailureResult("Cryptographic error verifying MFA setup. Please restart enrollment.");
        }

        var cleanCode = code?.Trim().Replace(" ", "").Replace("-", "") ?? string.Empty;
        var isValid = _totpService.ValidateTotp(plainSecret, cleanCode);

        if (!isValid)
        {
            setting.FailedAttempts++;
            if (setting.FailedAttempts >= MaxFailedAttempts)
            {
                setting.LockedUntil = DateTime.UtcNow.AddMinutes(LockoutDurationMinutes);
                await LogSecurityEventAsync(userId, user.Email, "MFA_ACCOUNT_LOCKED", "critical",
                    $"User locked out of MFA verification for {LockoutDurationMinutes} minutes after {setting.FailedAttempts} failed attempts.",
                    ipAddress, userAgent);
            }

            await LogSecurityEventAsync(userId, user.Email, "MFA_SETUP_VERIFICATION_FAILED", "warning",
                "Invalid TOTP verification code entered during MFA enrollment.", ipAddress, userAgent);

            await _context.SaveChangesAsync(ct);
            return ApiResponse<MfaVerifySetupResponseDto>.FailureResult("Invalid authentication code. Please check your authenticator app and try again.");
        }

        // Setup verified successfully!
        setting.SecretEncrypted = setting.PendingSecretEncrypted;
        setting.PendingSecretEncrypted = null;
        setting.IsEnabled = true;
        setting.EnabledAt = DateTime.UtcNow;
        setting.LastUsedAt = DateTime.UtcNow;
        setting.FailedAttempts = 0;
        setting.LockedUntil = null;
        setting.UpdatedAt = DateTime.UtcNow;

        // Sync User entity flag & wipe legacy plaintext
        user.IsTwoFactorEnabled = true;
        user.TwoFactorSecret = null;
        user.TwoFactorRecoveryCodesJson = null;

        // Invalidate any existing recovery codes and generate fresh ones
        var existingCodes = await _context.MfaRecoveryCodes.Where(c => c.UserId == userId).ToListAsync(ct);
        _context.MfaRecoveryCodes.RemoveRange(existingCodes);

        var plainRecoveryCodes = _totpService.GenerateRecoveryCodes(RecoveryCodeCount);
        foreach (var rawCode in plainRecoveryCodes)
        {
            var codeHash = _totpService.HashRecoveryCode(rawCode);
            _context.MfaRecoveryCodes.Add(new MfaRecoveryCode
            {
                UserId = userId,
                CodeHash = codeHash,
                CreatedAt = DateTime.UtcNow
            });
        }

        await LogSecurityEventAsync(userId, user.Email, "MFA_ENABLED", "info",
            "Multi-Factor Authentication (TOTP) successfully verified and enabled.", ipAddress, userAgent);

        _context.AuditLogs.Add(new AuditLog
        {
            Action = "ENABLE_MFA",
            EntityType = "User",
            EntityId = user.Id.ToString(),
            ActorName = user.Name,
            ActorEmail = user.Email,
            Details = "User enrolled in RFC 6238 Multi-Factor Authentication.",
            Module = "Security",
            Status = "success",
            IpAddress = ipAddress,
            UserAgent = userAgent,
            Timestamp = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(ct);

        var response = new MfaVerifySetupResponseDto
        {
            IsEnabled = true,
            EnabledAt = setting.EnabledAt.Value,
            RecoveryCodes = plainRecoveryCodes // Returned strictly once!
        };

        return ApiResponse<MfaVerifySetupResponseDto>.SuccessResult(response, "MFA enabled successfully. Store your recovery codes securely.");
    }

    public async Task<MfaChallengeResponseDto> CreateLoginChallengeAsync(
        int userId,
        string? ipAddress,
        string? userAgent,
        CancellationToken ct = default)
    {
        var rawTokenBytes = new byte[32];
        RandomNumberGenerator.Fill(rawTokenBytes);
        var challengeToken = Convert.ToHexString(rawTokenBytes).ToLowerInvariant();
        var tokenHash = HashString(challengeToken);

        var challenge = new MfaChallenge
        {
            UserId = userId,
            ChallengeTokenHash = tokenHash,
            ExpiresAt = DateTime.UtcNow.AddMinutes(ChallengeExpiryMinutes),
            AttemptCount = 0,
            IpAddress = ipAddress,
            UserAgent = userAgent,
            CreatedAt = DateTime.UtcNow
        };

        _context.MfaChallenges.Add(challenge);

        var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
        var email = user?.Email ?? "unknown";

        await LogSecurityEventAsync(userId, email, "MFA_LOGIN_CHALLENGE_CREATED", "info",
            "MFA challenge issued for login verification.", ipAddress, userAgent);

        await _context.SaveChangesAsync(ct);

        return new MfaChallengeResponseDto
        {
            RequiresMfa = true,
            ChallengeToken = challengeToken
        };
    }

    public async Task<ApiResponse<LoginResponseDto>> VerifyLoginChallengeAsync(
        string challengeToken,
        string code,
        string ipAddress,
        string userAgent,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(challengeToken) || string.IsNullOrWhiteSpace(code))
        {
            return ApiResponse<LoginResponseDto>.FailureResult("Challenge token and authentication code are required.");
        }

        var tokenHash = HashString(challengeToken.Trim());
        var challenge = await _context.MfaChallenges.FirstOrDefaultAsync(c => c.ChallengeTokenHash == tokenHash, ct);

        if (challenge == null)
        {
            return ApiResponse<LoginResponseDto>.FailureResult("Invalid or unrecognized authentication challenge.");
        }

        if (challenge.CompletedAt.HasValue)
        {
            return ApiResponse<LoginResponseDto>.FailureResult("This authentication challenge has already been completed.");
        }

        if (DateTime.UtcNow > challenge.ExpiresAt)
        {
            await LogSecurityEventAsync(challenge.UserId, string.Empty, "MFA_CHALLENGE_EXPIRED", "warning",
                "MFA login challenge has expired.", ipAddress, userAgent);
            await _context.SaveChangesAsync(ct);
            return ApiResponse<LoginResponseDto>.FailureResult("Authentication challenge expired. Please log in again.");
        }

        if (challenge.AttemptCount >= MaxFailedAttempts)
        {
            return ApiResponse<LoginResponseDto>.FailureResult("Maximum verification attempts exceeded for this session. Please log in again.");
        }

        challenge.AttemptCount++;

        var user = await _context.Users
            .Include(u => u.Role)
            .Include(u => u.Company)
            .FirstOrDefaultAsync(u => u.Id == challenge.UserId, ct);

        if (user == null || user.Status != UserStatus.Active)
        {
            return ApiResponse<LoginResponseDto>.FailureResult("User account is inactive or disabled.");
        }

        var setting = await _context.UserMfaSettings.FirstOrDefaultAsync(s => s.UserId == user.Id, ct);

        // Check account lock
        if (setting != null && setting.LockedUntil.HasValue && setting.LockedUntil.Value > DateTime.UtcNow)
        {
            var remaining = Math.Ceiling((setting.LockedUntil.Value - DateTime.UtcNow).TotalMinutes);
            return ApiResponse<LoginResponseDto>.FailureResult($"Account is temporarily locked due to multiple failed MFA attempts. Please try again in {remaining} minutes.");
        }

        // Retrieve secret
        string secret;
        if (setting != null && !string.IsNullOrWhiteSpace(setting.SecretEncrypted))
        {
            try
            {
                secret = _encryptionService.DecryptSecret(setting.SecretEncrypted);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to decrypt TOTP secret for user {UserId}", user.Id);
                return ApiResponse<LoginResponseDto>.FailureResult("Internal security error verifying MFA token.");
            }
        }
        else if (!string.IsNullOrWhiteSpace(user.TwoFactorSecret))
        {
            // Fallback legacy plaintext secret
            secret = user.TwoFactorSecret;
        }
        else
        {
            return ApiResponse<LoginResponseDto>.FailureResult("MFA configuration not found for user.");
        }

        var cleanCode = code.Trim().Replace(" ", "").Replace("-", "");
        var isValid = _totpService.ValidateTotp(secret, cleanCode);

        if (!isValid)
        {
            if (setting != null)
            {
                setting.FailedAttempts++;
                if (setting.FailedAttempts >= MaxFailedAttempts)
                {
                    setting.LockedUntil = DateTime.UtcNow.AddMinutes(LockoutDurationMinutes);
                    await LogSecurityEventAsync(user.Id, user.Email, "MFA_ACCOUNT_LOCKED", "critical",
                        $"Account locked for {LockoutDurationMinutes} minutes after {setting.FailedAttempts} failed MFA login attempts.",
                        ipAddress, userAgent);
                }
            }

            await LogSecurityEventAsync(user.Id, user.Email, "MFA_LOGIN_FAILED", "warning",
                "Invalid TOTP authentication code during login.", ipAddress, userAgent);

            await _context.SaveChangesAsync(ct);
            return ApiResponse<LoginResponseDto>.FailureResult("Invalid authentication code. Please check your authenticator app.");
        }

        // Successfully verified TOTP!
        challenge.CompletedAt = DateTime.UtcNow;

        if (setting != null)
        {
            setting.LastUsedAt = DateTime.UtcNow;
            setting.FailedAttempts = 0;
            setting.LockedUntil = null;
        }

        // Upgrade legacy secret to encrypted table if not present
        if (setting == null && !string.IsNullOrWhiteSpace(user.TwoFactorSecret))
        {
            setting = new UserMfaSetting
            {
                UserId = user.Id,
                IsEnabled = true,
                SecretEncrypted = _encryptionService.EncryptSecret(user.TwoFactorSecret),
                EnabledAt = DateTime.UtcNow,
                LastUsedAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow
            };
            user.TwoFactorSecret = null;
            _context.UserMfaSettings.Add(setting);
        }

        await LogSecurityEventAsync(user.Id, user.Email, "MFA_LOGIN_SUCCESS", "info",
            "User authenticated successfully via TOTP Multi-Factor Authentication.", ipAddress, userAgent);

        // Issue final authenticated JWT token
        return await CompleteLoginAsync(user, ipAddress, userAgent, ct);
    }

    public async Task<ApiResponse<LoginResponseDto>> VerifyRecoveryLoginAsync(
        string challengeToken,
        string recoveryCode,
        string ipAddress,
        string userAgent,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(challengeToken) || string.IsNullOrWhiteSpace(recoveryCode))
        {
            return ApiResponse<LoginResponseDto>.FailureResult("Challenge token and recovery code are required.");
        }

        var tokenHash = HashString(challengeToken.Trim());
        var challenge = await _context.MfaChallenges.FirstOrDefaultAsync(c => c.ChallengeTokenHash == tokenHash, ct);

        if (challenge == null)
        {
            return ApiResponse<LoginResponseDto>.FailureResult("Invalid or unrecognized authentication challenge.");
        }

        if (challenge.CompletedAt.HasValue)
        {
            return ApiResponse<LoginResponseDto>.FailureResult("This authentication challenge has already been completed.");
        }

        if (DateTime.UtcNow > challenge.ExpiresAt)
        {
            await LogSecurityEventAsync(challenge.UserId, string.Empty, "MFA_CHALLENGE_EXPIRED", "warning",
                "MFA login challenge has expired.", ipAddress, userAgent);
            await _context.SaveChangesAsync(ct);
            return ApiResponse<LoginResponseDto>.FailureResult("Authentication challenge expired. Please log in again.");
        }

        if (challenge.AttemptCount >= MaxFailedAttempts)
        {
            return ApiResponse<LoginResponseDto>.FailureResult("Maximum verification attempts exceeded for this session. Please log in again.");
        }

        challenge.AttemptCount++;

        var user = await _context.Users
            .Include(u => u.Role)
            .Include(u => u.Company)
            .FirstOrDefaultAsync(u => u.Id == challenge.UserId, ct);

        if (user == null || user.Status != UserStatus.Active)
        {
            return ApiResponse<LoginResponseDto>.FailureResult("User account is inactive or disabled.");
        }

        var targetHash = _totpService.HashRecoveryCode(recoveryCode);

        // 1. Check in MfaRecoveryCodes table
        var codeEntity = await _context.MfaRecoveryCodes
            .FirstOrDefaultAsync(c => c.UserId == user.Id && c.CodeHash == targetHash && c.UsedAt == null, ct);

        var isLegacyMatch = false;

        // 2. Fallback check in legacy JSON codes if not yet migrated
        if (codeEntity == null && !string.IsNullOrWhiteSpace(user.TwoFactorRecoveryCodesJson))
        {
            try
            {
                var codes = System.Text.Json.JsonSerializer.Deserialize<List<string>>(user.TwoFactorRecoveryCodesJson);
                var cleanUpper = recoveryCode.Trim().Replace("-", "").ToUpperInvariant();
                var formatted = $"{cleanUpper[..Math.Min(4, cleanUpper.Length)]}-{cleanUpper[Math.Min(4, cleanUpper.Length)..]}";

                if (codes != null && (codes.Contains(cleanUpper) || codes.Contains(formatted)))
                {
                    codes.Remove(cleanUpper);
                    codes.Remove(formatted);
                    user.TwoFactorRecoveryCodesJson = System.Text.Json.JsonSerializer.Serialize(codes);
                    isLegacyMatch = true;
                }
            }
            catch { }
        }

        if (codeEntity == null && !isLegacyMatch)
        {
            var setting = await _context.UserMfaSettings.FirstOrDefaultAsync(s => s.UserId == user.Id, ct);
            if (setting != null)
            {
                setting.FailedAttempts++;
                if (setting.FailedAttempts >= MaxFailedAttempts)
                {
                    setting.LockedUntil = DateTime.UtcNow.AddMinutes(LockoutDurationMinutes);
                    await LogSecurityEventAsync(user.Id, user.Email, "MFA_ACCOUNT_LOCKED", "critical",
                        $"Account locked for {LockoutDurationMinutes} minutes after failed recovery code attempts.",
                        ipAddress, userAgent);
                }
            }

            await LogSecurityEventAsync(user.Id, user.Email, "MFA_LOGIN_FAILED", "warning",
                "Invalid or already-used recovery code entered.", ipAddress, userAgent);

            await _context.SaveChangesAsync(ct);
            return ApiResponse<LoginResponseDto>.FailureResult("Invalid or already-used recovery code.");
        }

        // Consume single-use recovery code
        if (codeEntity != null)
        {
            codeEntity.UsedAt = DateTime.UtcNow;
        }

        challenge.CompletedAt = DateTime.UtcNow;

        var userSetting = await _context.UserMfaSettings.FirstOrDefaultAsync(s => s.UserId == user.Id, ct);
        if (userSetting != null)
        {
            userSetting.LastUsedAt = DateTime.UtcNow;
            userSetting.FailedAttempts = 0;
            userSetting.LockedUntil = null;
        }

        await LogSecurityEventAsync(user.Id, user.Email, "MFA_RECOVERY_CODE_USED", "warning",
            "Emergency single-use recovery code consumed for login.", ipAddress, userAgent);

        _context.AuditLogs.Add(new AuditLog
        {
            Action = "USE_RECOVERY_CODE",
            EntityType = "User",
            EntityId = user.Id.ToString(),
            ActorName = user.Name,
            ActorEmail = user.Email,
            Details = "Single-use emergency recovery code used to authenticate.",
            Module = "Security",
            Status = "success",
            IpAddress = ipAddress,
            UserAgent = userAgent,
            Timestamp = DateTime.UtcNow
        });

        return await CompleteLoginAsync(user, ipAddress, userAgent, ct);
    }

    public async Task<ApiResponse<bool>> DisableMfaAsync(
        int userId,
        string password,
        string? code,
        string? ipAddress,
        string? userAgent,
        CancellationToken ct = default)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user == null)
        {
            return ApiResponse<bool>.FailureResult("User not found.");
        }

        // 1. Verify user password
        if (string.IsNullOrWhiteSpace(password) || !PasswordHasher.VerifyPassword(password, user.PasswordHash))
        {
            await LogSecurityEventAsync(userId, user.Email, "MFA_DISABLE_FAILED", "warning",
                "Failed MFA disable attempt: incorrect password.", ipAddress, userAgent);
            await _context.SaveChangesAsync(ct);
            return ApiResponse<bool>.FailureResult("Password confirmation failed.");
        }

        var setting = await _context.UserMfaSettings.FirstOrDefaultAsync(s => s.UserId == userId, ct);

        // 2. Verify second factor (TOTP code or recovery code) if code provided
        if (!string.IsNullOrWhiteSpace(code))
        {
            var isCodeValid = false;
            var cleanCode = code.Trim().Replace(" ", "").Replace("-", "");

            if (setting != null && !string.IsNullOrWhiteSpace(setting.SecretEncrypted))
            {
                try
                {
                    var secret = _encryptionService.DecryptSecret(setting.SecretEncrypted);
                    isCodeValid = _totpService.ValidateTotp(secret, cleanCode);
                }
                catch { }
            }
            else if (!string.IsNullOrWhiteSpace(user.TwoFactorSecret))
            {
                isCodeValid = _totpService.ValidateTotp(user.TwoFactorSecret, cleanCode);
            }

            if (!isCodeValid)
            {
                // Check recovery code
                var codeHash = _totpService.HashRecoveryCode(code);
                var validRecovery = await _context.MfaRecoveryCodes
                    .FirstOrDefaultAsync(c => c.UserId == userId && c.CodeHash == codeHash && c.UsedAt == null, ct);

                if (validRecovery != null)
                {
                    validRecovery.UsedAt = DateTime.UtcNow;
                    isCodeValid = true;
                }
            }

            if (!isCodeValid)
            {
                await LogSecurityEventAsync(userId, user.Email, "MFA_DISABLE_FAILED", "warning",
                    "Failed MFA disable attempt: invalid verification code.", ipAddress, userAgent);
                await _context.SaveChangesAsync(ct);
                return ApiResponse<bool>.FailureResult("Invalid authentication or recovery code.");
            }
        }

        // 3. Disable MFA and wipe sensitive tokens
        if (setting != null)
        {
            setting.IsEnabled = false;
            setting.SecretEncrypted = string.Empty;
            setting.PendingSecretEncrypted = null;
            setting.EnabledAt = null;
            setting.FailedAttempts = 0;
            setting.LockedUntil = null;
            setting.UpdatedAt = DateTime.UtcNow;
        }

        user.IsTwoFactorEnabled = false;
        user.TwoFactorSecret = null;
        user.TwoFactorRecoveryCodesJson = null;

        // Invalidate all recovery codes
        var recoveryCodes = await _context.MfaRecoveryCodes.Where(c => c.UserId == userId).ToListAsync(ct);
        _context.MfaRecoveryCodes.RemoveRange(recoveryCodes);

        // Invalidate active login challenges
        var challenges = await _context.MfaChallenges.Where(c => c.UserId == userId && c.CompletedAt == null).ToListAsync(ct);
        foreach (var ch in challenges)
        {
            ch.CompletedAt = DateTime.UtcNow;
        }

        await LogSecurityEventAsync(userId, user.Email, "MFA_DISABLED", "warning",
            "Multi-Factor Authentication disabled for user.", ipAddress, userAgent);

        _context.AuditLogs.Add(new AuditLog
        {
            Action = "DISABLE_MFA",
            EntityType = "User",
            EntityId = user.Id.ToString(),
            ActorName = user.Name,
            ActorEmail = user.Email,
            Details = "Multi-Factor Authentication was disabled.",
            Module = "Security",
            Status = "success",
            IpAddress = ipAddress,
            UserAgent = userAgent,
            Timestamp = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(ct);
        return ApiResponse<bool>.SuccessResult(true, "Two-factor authentication has been disabled.");
    }

    public async Task<ApiResponse<List<string>>> RegenerateRecoveryCodesAsync(
        int userId,
        string password,
        string? code,
        string? ipAddress,
        string? userAgent,
        CancellationToken ct = default)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user == null)
        {
            return ApiResponse<List<string>>.FailureResult("User not found.");
        }

        if (string.IsNullOrWhiteSpace(password) || !PasswordHasher.VerifyPassword(password, user.PasswordHash))
        {
            await LogSecurityEventAsync(userId, user.Email, "MFA_SECURITY_VERIFY_FAILED", "warning",
                "Password check failed while attempting to regenerate recovery codes.", ipAddress, userAgent);
            await _context.SaveChangesAsync(ct);
            return ApiResponse<List<string>>.FailureResult("Current password is required to regenerate backup recovery codes.");
        }

        var setting = await _context.UserMfaSettings.FirstOrDefaultAsync(s => s.UserId == userId, ct);
        var isEnabled = setting != null ? setting.IsEnabled : user.IsTwoFactorEnabled;

        if (!isEnabled)
        {
            return ApiResponse<List<string>>.FailureResult("Two-factor authentication is not active.");
        }

        // If code provided, verify TOTP
        if (!string.IsNullOrWhiteSpace(code))
        {
            var isTotpValid = false;
            var clean = code.Trim().Replace(" ", "").Replace("-", "");

            if (setting != null && !string.IsNullOrWhiteSpace(setting.SecretEncrypted))
            {
                try
                {
                    var secret = _encryptionService.DecryptSecret(setting.SecretEncrypted);
                    isTotpValid = _totpService.ValidateTotp(secret, clean);
                }
                catch { }
            }
            else if (!string.IsNullOrWhiteSpace(user.TwoFactorSecret))
            {
                isTotpValid = _totpService.ValidateTotp(user.TwoFactorSecret, clean);
            }

            if (!isTotpValid)
            {
                return ApiResponse<List<string>>.FailureResult("Invalid TOTP verification code.");
            }
        }

        // Invalidate old recovery codes
        var oldCodes = await _context.MfaRecoveryCodes.Where(c => c.UserId == userId).ToListAsync(ct);
        _context.MfaRecoveryCodes.RemoveRange(oldCodes);
        user.TwoFactorRecoveryCodesJson = null;

        // Generate new recovery codes
        var newPlainCodes = _totpService.GenerateRecoveryCodes(RecoveryCodeCount);
        foreach (var rawCode in newPlainCodes)
        {
            var codeHash = _totpService.HashRecoveryCode(rawCode);
            _context.MfaRecoveryCodes.Add(new MfaRecoveryCode
            {
                UserId = userId,
                CodeHash = codeHash,
                CreatedAt = DateTime.UtcNow
            });
        }

        await LogSecurityEventAsync(userId, user.Email, "MFA_RECOVERY_CODES_REGENERATED", "info",
            "Emergency recovery codes regenerated. All prior codes invalidated.", ipAddress, userAgent);

        _context.AuditLogs.Add(new AuditLog
        {
            Action = "REGENERATE_MFA_RECOVERY_CODES",
            EntityType = "User",
            EntityId = user.Id.ToString(),
            ActorName = user.Name,
            ActorEmail = user.Email,
            Details = "Regenerated two-factor recovery codes. Old codes invalidated.",
            Module = "Security",
            Status = "success",
            IpAddress = ipAddress,
            UserAgent = userAgent,
            Timestamp = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(ct);
        return ApiResponse<List<string>>.SuccessResult(newPlainCodes, "New recovery codes generated successfully. Store them safely.");
    }

    private async Task<ApiResponse<LoginResponseDto>> CompleteLoginAsync(
        User user,
        string ipAddress,
        string userAgent,
        CancellationToken ct)
    {
        user.LastLoginAt = DateTime.UtcNow;

        var (token, jti, _) = _jwtService.GenerateTokenWithDetails(user);

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

        await _context.SaveChangesAsync(ct);

        var responseDto = new LoginResponseDto
        {
            Token = token,
            User = MapToUserDto(user),
            Tenant = user.Company != null ? MapToTenantDto(user.Company) : null,
            RequiresTwoFactor = false,
            RequiresMfa = false,
            MustEnrollTwoFactor = user.RoleId == 1 && !user.IsTwoFactorEnabled,
            MustChangePassword = user.MustChangePassword
        };

        return ApiResponse<LoginResponseDto>.SuccessResult(responseDto, "Two-factor verification successful.");
    }

    private Task LogSecurityEventAsync(
        int? userId,
        string email,
        string eventType,
        string severity,
        string details,
        string? ipAddress,
        string? userAgent)
    {
        _context.SecurityEvents.Add(new SecurityEvent
        {
            UserId = userId,
            ActorEmail = email ?? string.Empty,
            EventType = eventType,
            Severity = severity,
            Details = details,
            IpAddress = string.IsNullOrWhiteSpace(ipAddress) ? "127.0.0.1" : ipAddress,
            UserAgent = string.IsNullOrWhiteSpace(userAgent) ? "Unknown" : userAgent,
            CreatedAt = DateTime.UtcNow
        });
        return Task.CompletedTask;
    }

    private static string HashString(string input)
    {
        var bytes = Encoding.UTF8.GetBytes(input);
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private static string DetectDevice(string userAgent)
    {
        if (string.IsNullOrWhiteSpace(userAgent)) return "Desktop / Web Browser";
        var ua = userAgent.ToLowerInvariant();
        if (ua.Contains("iphone") || ua.Contains("ipad") || ua.Contains("ipod")) return "iOS Safari";
        if (ua.Contains("android")) return "Android Chrome";
        if (ua.Contains("macintosh") || ua.Contains("mac os")) return "macOS Safari";
        if (ua.Contains("windows")) return "Windows Desktop";
        if (ua.Contains("linux")) return "Linux Desktop";
        return "Desktop / Web Browser";
    }

    private static UserDto MapToUserDto(User user)
    {
        return new UserDto
        {
            Id = user.Id.ToString(),
            Name = user.Name,
            Email = user.Email,
            Phone = user.Phone,
            Role = user.Role != null ? new RoleDto
            {
                Id = user.Role.Id.ToString(),
                Name = user.Role.Name,
                Code = user.Role.Code,
                Permissions = user.Role.Permissions
            } : new RoleDto(),
            CompanyId = user.CompanyId?.ToString(),
            CompanySlug = user.Company?.Slug,
            CompanyName = user.Company?.Name,
            Status = user.Status.ToString(),
            LastLogin = "Just now",
            Avatar = user.AvatarUrl,
            MustChangePassword = user.MustChangePassword
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
