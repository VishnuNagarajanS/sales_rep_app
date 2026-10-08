using System.Security.Cryptography;
using System.Text;
using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.Irm;
using backend.Models.Entities;
using backend.Repositories.Interfaces;
using backend.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace backend.Services.Implementations;

public class OtpService : IOtpService
{
    private readonly ApplicationDbContext _db;
    private readonly IMemoryCache _cache;
    private readonly IKycRepository _kycRepo;
    private readonly IEmailService _emailService;
    private readonly IConfiguration _config;
    private readonly ILogger<OtpService> _logger;

    public OtpService(
        ApplicationDbContext db,
        IMemoryCache cache,
        IKycRepository kycRepo,
        IEmailService emailService,
        IConfiguration config,
        ILogger<OtpService> logger)
    {
        _db = db;
        _cache = cache;
        _kycRepo = kycRepo;
        _emailService = emailService;
        _config = config;
        _logger = logger;
    }

    private static readonly string _fallbackRuntimeKey = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));

    private string GetConfiguredSecretKey()
    {
        var key = _config["KycOtpSettings:SecretKey"]
                  ?? _config["JwtSettings:SecretKey"];

        return !string.IsNullOrWhiteSpace(key) ? key : _fallbackRuntimeKey;
    }

    private string ComputeOtpHash(string otp, string recordSalt)
    {
        var secret = GetConfiguredSecretKey();
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var payload = $"{recordSalt}:{otp}";
        var hashBytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(payload));
        return Convert.ToHexString(hashBytes).ToLowerInvariant();
    }

    private static string HashToken(string rawToken)
    {
        if (string.IsNullOrWhiteSpace(rawToken)) return string.Empty;
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(rawToken.Trim()));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    public async Task<ApiResponse<SendKycOtpResponseDto>> SendKycOtpAsync(SendKycOtpRequestDto dto, CancellationToken ct = default)
    {
        var cleanToken = CleanToken(dto.Token);
        if (string.IsNullOrWhiteSpace(cleanToken))
        {
            return ApiResponse<SendKycOtpResponseDto>.ErrorResponse("An active KYC token is required to request a verification code.");
        }

        // 1. Resolve KYC record by active token
        var kyc = await ResolveKycByTokenAsync(cleanToken, ct);
        if (kyc == null)
        {
            return ApiResponse<SendKycOtpResponseDto>.ErrorResponse("Invalid or expired KYC token. Please check your link or contact your Relationship Manager.");
        }

        // 2. Validate registered email on KYC record and require exact match if email was provided
        var registeredEmail = kyc.Email?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(registeredEmail))
        {
            if (!string.IsNullOrWhiteSpace(dto.Email) && System.Net.Mail.MailAddress.TryCreate(dto.Email.Trim(), out _))
            {
                registeredEmail = dto.Email.Trim();
                kyc.Email = registeredEmail;
                await _kycRepo.UpdateAsync(kyc, ct);
            }
            else
            {
                return ApiResponse<SendKycOtpResponseDto>.ErrorResponse(
                    "No registered email address is associated with this KYC request. Please enter a valid email address to receive your verification code.");
            }
        }

        var normalizedEmail = registeredEmail.ToLowerInvariant();

        if (!string.IsNullOrWhiteSpace(dto.Email))
        {
            var requestedEmail = dto.Email.Trim().ToLowerInvariant();
            if (requestedEmail != normalizedEmail)
            {
                return ApiResponse<SendKycOtpResponseDto>.ErrorResponse(
                    "The provided email address does not match the registered KYC email. Verification codes can only be sent to the registered email.");
            }
        }

        var targetName = !string.IsNullOrWhiteSpace(kyc.InvestorName) ? kyc.InvestorName.Trim() : "Investor";
        var companyId = kyc.CompanyId;

        // 3. Multi-instance Database Resend Rate Limiting: Max 5 resends in 15 minutes, min 20 seconds between resends
        var recentCutoff = DateTime.UtcNow.AddMinutes(-15);
        var tokenHash = HashToken(cleanToken);
        var recentOtps = await _db.KycOtpVerifications
            .Where(v => (v.Token == cleanToken || v.TokenHash == tokenHash) && v.Email == normalizedEmail && v.CreatedAt >= recentCutoff)
            .OrderByDescending(v => v.CreatedAt)
            .ToListAsync(ct);

        if (recentOtps.Count >= 5)
        {
            return ApiResponse<SendKycOtpResponseDto>.ErrorResponse(
                "Too many OTP requests in a short period. For security, please wait 15 minutes before requesting a new code.");
        }

        var latestOtp = recentOtps.FirstOrDefault();
        if (latestOtp != null && (DateTime.UtcNow - latestOtp.CreatedAt).TotalSeconds < 20)
        {
            var remainingSec = (int)(20 - (DateTime.UtcNow - latestOtp.CreatedAt).TotalSeconds);
            return ApiResponse<SendKycOtpResponseDto>.ErrorResponse(
                $"Please wait {remainingSec} second(s) before requesting another verification code.");
        }

        // 4. Invalidate previous pending OTPs in database for this exact token and email
        var pendingOtps = await _db.KycOtpVerifications
            .Where(v => (v.Token == cleanToken || v.TokenHash == tokenHash) && v.Email == normalizedEmail && !v.IsInvalidated && !v.IsVerified)
            .ToListAsync(ct);

        foreach (var p in pendingOtps)
        {
            p.IsInvalidated = true;
        }

        // 5. Generate fresh cryptographically random 6-digit OTP and unique per-record salt
        var otpCode = RandomNumberGenerator.GetInt32(100000, 1000000).ToString("D6");
        var perRecordSalt = Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant();
        var otpHash = ComputeOtpHash(otpCode, perRecordSalt);

        // 6. Dispatch email via provider
        _logger.LogInformation("[KYC OTP] Dispatching verification code to registered email for KYC ID: {KycId}", kyc.Id);
        var emailDelivered = await _emailService.SendKycOtpEmailAsync(registeredEmail, targetName, otpCode, 5, ct);
        var masked = MaskEmail(registeredEmail);

        if (!emailDelivered)
        {
            _logger.LogError("[KYC OTP] Email delivery failed for registered email. Error: {Error}", _emailService.LastError);
            return ApiResponse<SendKycOtpResponseDto>.ErrorResponse(
                $"Failed to deliver verification code to {masked}. Please check your email address or try again in a few moments.");
        }

        // 7. Record verified state in database with per-record salt and secure hash
        var otpRecord = new KycOtpVerification
        {
            CompanyId = companyId,
            InvestorKycId = kyc.Id,
            Token = string.Empty, // Do not persist raw token in plaintext
            TokenHash = tokenHash,
            Email = normalizedEmail,
            OtpHash = otpHash,
            Salt = perRecordSalt,
            ExpiresAt = DateTime.UtcNow.AddMinutes(5),
            FailedAttempts = 0,
            ResendCount = recentOtps.Count + 1,
            IsVerified = false,
            IsInvalidated = false,
            CreatedAt = DateTime.UtcNow
        };

        _db.KycOtpVerifications.Add(otpRecord);
        await _db.SaveChangesAsync(ct);

        _cache.Set($"kyc_otp_rec_{otpRecord.Id}", otpRecord, TimeSpan.FromMinutes(5));

        var message = $"6-digit verification code sent to {masked}";
        return ApiResponse<SendKycOtpResponseDto>.SuccessResponse(new SendKycOtpResponseDto
        {
            Success = true,
            MaskedEmail = masked,
            ExpiresInSeconds = 300,
            Message = message
        }, message);
    }

    public async Task<ApiResponse<VerifyKycOtpResponseDto>> VerifyKycOtpAsync(VerifyKycOtpRequestDto dto, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(dto.Otp))
        {
            return ApiResponse<VerifyKycOtpResponseDto>.ErrorResponse("Please enter the 6-digit verification code.");
        }

        var cleanToken = CleanToken(dto.Token);
        var cleanEmail = dto.Email?.Trim().ToLowerInvariant() ?? string.Empty;
        var inputOtp = dto.Otp.Trim();

        // Exact match required on BOTH the active KYC token AND the registered email address
        if (string.IsNullOrWhiteSpace(cleanToken) || string.IsNullOrWhiteSpace(cleanEmail))
        {
            return ApiResponse<VerifyKycOtpResponseDto>.ErrorResponse(
                "Both the active KYC token and registered email address are required for OTP verification.");
        }

        // Verify active token validity against KYC repository
        var kyc = await ResolveKycByTokenAsync(cleanToken, ct);
        if (kyc == null)
        {
            return ApiResponse<VerifyKycOtpResponseDto>.ErrorResponse("Invalid or expired KYC token. Please request a new link.");
        }

        var registeredEmail = kyc.Email?.Trim().ToLowerInvariant() ?? string.Empty;
        if (registeredEmail != cleanEmail)
        {
            return ApiResponse<VerifyKycOtpResponseDto>.ErrorResponse("Verification failed: The provided email does not match the registered KYC token.");
        }

        var tokenHash = HashToken(cleanToken);

        // 1. Fetch active, non-invalidated, non-verified OTP record bound to BOTH token AND email
        var record = await _db.KycOtpVerifications
            .Where(v => !v.IsInvalidated &&
                        !v.IsVerified &&
                        v.ExpiresAt > DateTime.UtcNow &&
                        (v.Token == cleanToken || v.TokenHash == tokenHash) &&
                        v.Email == cleanEmail)
            .OrderByDescending(v => v.CreatedAt)
            .FirstOrDefaultAsync(ct);

        if (record == null)
        {
            return ApiResponse<VerifyKycOtpResponseDto>.ErrorResponse(
                "Verification code has expired or was not requested for this token and email. Please click Resend Code.");
        }

        // 2. Check total attempt limits across the active verification window
        var windowCutoff = DateTime.UtcNow.AddMinutes(-15);
        var totalFailedAttempts = await _db.KycOtpVerifications
            .Where(v => (v.TokenHash == tokenHash || v.Token == cleanToken) && v.Email == cleanEmail && v.CreatedAt >= windowCutoff)
            .SumAsync(v => v.FailedAttempts, ct);

        if (record.FailedAttempts >= 5 || totalFailedAttempts >= 5)
        {
            record.IsInvalidated = true;
            await _db.SaveChangesAsync(ct);
            return ApiResponse<VerifyKycOtpResponseDto>.ErrorResponse(
                "Too many incorrect attempts. For security, please wait 15 minutes before requesting a new code.");
        }

        // 3. Verify entered OTP hash using per-record salt and secure configured key
        var inputHash = ComputeOtpHash(inputOtp, record.Salt);
        var expectedBytes = Encoding.UTF8.GetBytes(record.OtpHash);
        var actualBytes = Encoding.UTF8.GetBytes(inputHash);

        if (CryptographicOperations.FixedTimeEquals(expectedBytes, actualBytes))
        {
            record.IsVerified = true;
            record.VerifiedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);

            _logger.LogInformation("[KYC OTP] Identity successfully verified for KYC OTP Record ID: {Id}", record.Id);

            return ApiResponse<VerifyKycOtpResponseDto>.SuccessResponse(new VerifyKycOtpResponseDto
            {
                Verified = true,
                Message = "Identity verified successfully!",
                Email = record.Email
            }, "Identity verified successfully!");
        }

        // Mismatch: increment failed attempts
        record.FailedAttempts++;
        if (record.FailedAttempts >= 5)
        {
            record.IsInvalidated = true;
        }
        await _db.SaveChangesAsync(ct);

        var remaining = Math.Max(0, 5 - record.FailedAttempts);
        return ApiResponse<VerifyKycOtpResponseDto>.ErrorResponse(
            remaining > 0
                ? $"Invalid verification code. {remaining} attempt(s) remaining."
                : "Too many incorrect attempts. Please request a new verification code.");
    }

    public async Task<bool> HasVerifiedOtpAsync(string token, string? email, CancellationToken ct = default)
    {
        var cleanToken = CleanToken(token);
        var cleanEmail = email?.Trim().ToLowerInvariant() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(cleanToken) || string.IsNullOrWhiteSpace(cleanEmail))
        {
            return false;
        }

        var tokenHash = HashToken(cleanToken);
        var validCutoff = DateTime.UtcNow.AddHours(-2); // verified within the last 2 hours

        return await _db.KycOtpVerifications.AnyAsync(v =>
            v.IsVerified &&
            !v.IsInvalidated &&
            v.VerifiedAt.HasValue &&
            v.VerifiedAt.Value >= validCutoff &&
            (v.Token == cleanToken || v.TokenHash == tokenHash) &&
            v.Email == cleanEmail, ct);
    }

    public async Task InvalidateOtpAsync(string token, string? email, CancellationToken ct = default)
    {
        var cleanToken = CleanToken(token);
        var cleanEmail = email?.Trim().ToLowerInvariant() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(cleanToken) && string.IsNullOrWhiteSpace(cleanEmail)) return;

        var tokenHash = !string.IsNullOrEmpty(cleanToken) ? HashToken(cleanToken) : string.Empty;
        var activeRecords = await _db.KycOtpVerifications
            .Where(v => !v.IsInvalidated &&
                        (!string.IsNullOrEmpty(cleanToken) && (v.Token == cleanToken || v.TokenHash == tokenHash)) &&
                        (!string.IsNullOrEmpty(cleanEmail) && v.Email == cleanEmail))
            .ToListAsync(ct);

        foreach (var r in activeRecords)
        {
            r.IsInvalidated = true;
        }

        if (activeRecords.Count > 0)
        {
            await _db.SaveChangesAsync(ct);
        }
    }

    private async Task<InvestorKyc?> ResolveKycByTokenAsync(string token, CancellationToken ct)
    {
        return await _kycRepo.GetByTokenAsync(token, ct);
    }

    private static string CleanToken(string? rawToken)
    {
        if (string.IsNullOrWhiteSpace(rawToken)) return string.Empty;
        var t = rawToken.Trim();
        if (t.Contains('/')) t = t.Split('/').Last();
        if (t.Contains('?')) t = t.Split('?').First();
        return t;
    }

    private static string MaskEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@'))
            return "your email";

        var parts = email.Split('@');
        var name = parts[0];
        var domain = parts[1];

        if (name.Length <= 2)
            return $"{name}***@{domain}";

        return $"{name[0]}***{name[^1]}@{domain}";
    }
}
