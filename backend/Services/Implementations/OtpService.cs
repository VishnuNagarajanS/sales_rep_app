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

namespace backend.Services.Implementations;

public class OtpService : IOtpService
{
    private readonly ApplicationDbContext _db;
    private readonly IMemoryCache _cache;
    private readonly IKycRepository _kycRepo;
    private readonly IEmailService _emailService;
    private readonly ILogger<OtpService> _logger;

    private const string Salt = "NexusSales_Kyc_Otp_Salt_2026";

    public OtpService(
        ApplicationDbContext db,
        IMemoryCache cache,
        IKycRepository kycRepo,
        IEmailService emailService,
        ILogger<OtpService> logger)
    {
        _db = db;
        _cache = cache;
        _kycRepo = kycRepo;
        _emailService = emailService;
        _logger = logger;
    }

    private static string HashValue(string input)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(input + Salt));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    public async Task<ApiResponse<SendKycOtpResponseDto>> SendKycOtpAsync(SendKycOtpRequestDto dto, CancellationToken ct = default)
    {
        var cleanToken = CleanToken(dto.Token);
        if (string.IsNullOrWhiteSpace(cleanToken) && string.IsNullOrWhiteSpace(dto.Email))
        {
            return ApiResponse<SendKycOtpResponseDto>.ErrorResponse("KYC token or email address is required.");
        }

        // 1. Resolve KYC record and target email
        InvestorKyc? kyc = null;
        if (!string.IsNullOrWhiteSpace(cleanToken))
        {
            kyc = await ResolveKycByTokenAsync(cleanToken, ct);
            if (kyc == null && string.IsNullOrWhiteSpace(dto.Email))
            {
                return ApiResponse<SendKycOtpResponseDto>.ErrorResponse("Invalid or expired KYC token. Please check your link or contact your IRM.");
            }
        }

        // Prioritize registered email on the verified KYC record
        var targetEmail = !string.IsNullOrWhiteSpace(kyc?.Email)
            ? kyc.Email.Trim()
            : (!string.IsNullOrWhiteSpace(dto.Email) ? dto.Email.Trim() : string.Empty);

        if (string.IsNullOrWhiteSpace(targetEmail))
        {
            return ApiResponse<SendKycOtpResponseDto>.ErrorResponse(
                "No registered email address is associated with this KYC request. Please contact your Relationship Manager.");
        }

        var normalizedEmail = targetEmail.ToLowerInvariant();
        var targetName = !string.IsNullOrWhiteSpace(kyc?.InvestorName) ? kyc.InvestorName.Trim() : "Investor";
        var companyId = kyc?.CompanyId ?? 1;

        // 2. Multi-instance Database Resend Rate Limiting: Max 5 resends in 15 minutes, min 20 seconds between resends
        var recentCutoff = DateTime.UtcNow.AddMinutes(-15);
        var recentOtps = await _db.KycOtpVerifications
            .Where(v => (v.Token == cleanToken || v.Email == normalizedEmail) && v.CreatedAt >= recentCutoff)
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

        // 3. Invalidate previous pending OTPs in database (multi-instance safe)
        var pendingOtps = await _db.KycOtpVerifications
            .Where(v => (v.Token == cleanToken || v.Email == normalizedEmail) && !v.IsInvalidated && !v.IsVerified)
            .ToListAsync(ct);

        foreach (var p in pendingOtps)
        {
            p.IsInvalidated = true;
        }

        // 4. Generate fresh cryptographically random 6-digit OTP
        var otpCode = RandomNumberGenerator.GetInt32(100000, 1000000).ToString("D6");
        var otpHash = HashValue(otpCode);
        var tokenHash = !string.IsNullOrEmpty(cleanToken) ? HashValue(cleanToken) : string.Empty;

        // 5. Dispatch email via provider
        _logger.LogInformation("[KYC OTP] Dispatching verification code to registered email for KYC ID: {KycId}", kyc?.Id);
        var emailDelivered = await _emailService.SendKycOtpEmailAsync(targetEmail, targetName, otpCode, 5, ct);
        var masked = MaskEmail(targetEmail);

        if (!emailDelivered)
        {
            _logger.LogWarning("[KYC OTP] Email delivery failed for registered email. Error: {Error}", _emailService.LastError);
            return ApiResponse<SendKycOtpResponseDto>.ErrorResponse(
                $"Failed to deliver verification code to {masked}. {_emailService.LastError ?? "Please verify your email provider settings or try again."}");
        }

        // 6. Record verified state in database (accessible across all backend instances & restarts)
        var otpRecord = new KycOtpVerification
        {
            CompanyId = companyId,
            InvestorKycId = kyc?.Id,
            Token = cleanToken,
            TokenHash = tokenHash,
            Email = normalizedEmail,
            OtpHash = otpHash,
            ExpiresAt = DateTime.UtcNow.AddMinutes(5),
            FailedAttempts = 0,
            ResendCount = recentOtps.Count + 1,
            IsVerified = false,
            IsInvalidated = false,
            CreatedAt = DateTime.UtcNow
        };

        _db.KycOtpVerifications.Add(otpRecord);
        await _db.SaveChangesAsync(ct);

        // Also update memory cache as fast L1 cache
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

        // 1. Fetch active, non-invalidated, non-verified OTP record from database
        var record = await _db.KycOtpVerifications
            .Where(v => !v.IsInvalidated && !v.IsVerified && v.ExpiresAt > DateTime.UtcNow &&
                        ((!string.IsNullOrEmpty(cleanToken) && v.Token == cleanToken) ||
                         (!string.IsNullOrEmpty(cleanEmail) && v.Email == cleanEmail)))
            .OrderByDescending(v => v.CreatedAt)
            .FirstOrDefaultAsync(ct);

        if (record == null)
        {
            return ApiResponse<VerifyKycOtpResponseDto>.ErrorResponse(
                "Verification code has expired or was not requested. Please click Resend Code.");
        }

        // 2. Check attempt limits
        if (record.FailedAttempts >= 5)
        {
            record.IsInvalidated = true;
            await _db.SaveChangesAsync(ct);
            return ApiResponse<VerifyKycOtpResponseDto>.ErrorResponse(
                "Too many incorrect attempts. Please request a new verification code.");
        }

        // 3. Verify entered OTP hash
        var inputHash = HashValue(inputOtp);
        if (record.OtpHash == inputHash)
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
        var validCutoff = DateTime.UtcNow.AddHours(-2); // verified within the last 2 hours

        return await _db.KycOtpVerifications.AnyAsync(v =>
            v.IsVerified &&
            !v.IsInvalidated &&
            v.VerifiedAt.HasValue &&
            v.VerifiedAt.Value >= validCutoff &&
            ((!string.IsNullOrEmpty(cleanToken) && v.Token == cleanToken) ||
             (!string.IsNullOrEmpty(cleanEmail) && v.Email == cleanEmail)), ct);
    }

    public async Task InvalidateOtpAsync(string token, string? email, CancellationToken ct = default)
    {
        var cleanToken = CleanToken(token);
        var cleanEmail = email?.Trim().ToLowerInvariant() ?? string.Empty;

        var activeRecords = await _db.KycOtpVerifications
            .Where(v => !v.IsInvalidated &&
                        ((!string.IsNullOrEmpty(cleanToken) && v.Token == cleanToken) ||
                         (!string.IsNullOrEmpty(cleanEmail) && v.Email == cleanEmail)))
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
