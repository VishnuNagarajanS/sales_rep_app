using System.Security.Cryptography;
using backend.DTOs.Common;
using backend.DTOs.Irm;
using backend.Models.Entities;
using backend.Repositories.Interfaces;
using backend.Services.Interfaces;
using Microsoft.Extensions.Caching.Memory;

namespace backend.Services.Implementations;

public class OtpService : IOtpService
{
    private readonly IMemoryCache _cache;
    private readonly IKycRepository _kycRepo;
    private readonly IEmailService _emailService;
    private readonly ILogger<OtpService> _logger;

    private class CachedOtpEntry
    {
        public string Otp { get; set; } = string.Empty;
        public List<string> ValidOtps { get; set; } = new();
        public string Email { get; set; } = string.Empty;
        public string Token { get; set; } = string.Empty;
        public int FailedAttempts { get; set; } = 0;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public OtpService(
        IMemoryCache cache,
        IKycRepository kycRepo,
        IEmailService emailService,
        ILogger<OtpService> logger)
    {
        _cache = cache;
        _kycRepo = kycRepo;
        _emailService = emailService;
        _logger = logger;
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

        // Always prioritize the email stored on the KYC record associated with the token
        var targetEmail = !string.IsNullOrWhiteSpace(kyc?.Email)
            ? kyc.Email.Trim()
            : (!string.IsNullOrWhiteSpace(dto.Email) ? dto.Email.Trim() : string.Empty);

        if (string.IsNullOrWhiteSpace(targetEmail))
        {
            return ApiResponse<SendKycOtpResponseDto>.ErrorResponse(
                "No registered email address is associated with this KYC request. Please contact your Relationship Manager.");
        }

        var targetName = !string.IsNullOrWhiteSpace(kyc?.InvestorName) ? kyc.InvestorName.Trim() : "Investor";

        var cacheKey = GetCacheKey(cleanToken, targetEmail);

        // Issue a fresh valid 6-digit cryptographic OTP on every send/resend
        var otpCode = RandomNumberGenerator.GetInt32(100000, 1000000).ToString("D6");

        // Cache OTP for 5 minutes; invalidate previous OTPs so old codes cannot be re-used
        var entry = new CachedOtpEntry
        {
            Otp = otpCode,
            Email = targetEmail,
            Token = cleanToken,
            FailedAttempts = 0,
            CreatedAt = DateTime.UtcNow,
            ValidOtps = new List<string> { otpCode }
        };

        _cache.Set(cacheKey, entry, TimeSpan.FromMinutes(5));
        _cache.Set($"kyc_email_otp_{targetEmail.ToLowerInvariant()}", entry, TimeSpan.FromMinutes(5));

        if (!string.IsNullOrEmpty(cleanToken))
        {
            _cache.Set($"kyc_token_otp_{cleanToken}", entry, TimeSpan.FromMinutes(5));
        }

        if (kyc != null && !string.IsNullOrWhiteSpace(kyc.KycLinkToken))
        {
            _cache.Set($"kyc_token_otp_{kyc.KycLinkToken}", entry, TimeSpan.FromMinutes(5));
        }

        // Also cache under token prefix without 'tok_' and slug so lookup is resilient
        var subToken = cleanToken.StartsWith("tok_") ? cleanToken[4..] : cleanToken;
        var tokenPrefix = subToken.Contains('_') ? subToken.Split('_')[0] : subToken;
        if (!string.IsNullOrEmpty(tokenPrefix) && tokenPrefix != cleanToken)
        {
            _cache.Set($"kyc_token_otp_{tokenPrefix}", entry, TimeSpan.FromMinutes(5));
            _cache.Set($"kyc_token_otp_tok_{tokenPrefix}", entry, TimeSpan.FromMinutes(5));
        }

        // 4. Dispatch Email via Gmail SMTP (OTP not logged at info level to prevent exposure)
        _logger.LogInformation("[KYC OTP] Sending verification code to {Email}", targetEmail);

        var emailDelivered = await _emailService.SendKycOtpEmailAsync(targetEmail, targetName, otpCode, 5, ct);

        var masked = MaskEmail(targetEmail);

        if (!emailDelivered)
        {
            _logger.LogWarning("[KYC OTP] Email delivery failed for {Email}: {Error}", targetEmail, _emailService.LastError);

            // Invalidate cached entry since delivery failed
            _cache.Remove(cacheKey);
            _cache.Remove($"kyc_email_otp_{targetEmail.ToLowerInvariant()}");
            if (!string.IsNullOrEmpty(cleanToken)) _cache.Remove($"kyc_token_otp_{cleanToken}");

            return ApiResponse<SendKycOtpResponseDto>.ErrorResponse(
                $"Failed to deliver verification code to {masked}. {_emailService.LastError ?? "Please verify your email provider settings or try again."}");
        }

        var message = $"6-digit verification code sent to {masked}";

        return ApiResponse<SendKycOtpResponseDto>.SuccessResponse(new SendKycOtpResponseDto
        {
            Success = true,
            MaskedEmail = masked,
            ExpiresInSeconds = 300,
            Message = message
        }, message);
    }

    public Task<ApiResponse<VerifyKycOtpResponseDto>> VerifyKycOtpAsync(VerifyKycOtpRequestDto dto, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(dto.Otp))
        {
            return Task.FromResult(ApiResponse<VerifyKycOtpResponseDto>.ErrorResponse("Please enter the 6-digit verification code."));
        }

        var cleanToken = CleanToken(dto.Token);
        CachedOtpEntry? entry = null;
        string activeKey = string.Empty;

        // Primary: look up by token (most specific — matches the exact KYC request)
        if (!string.IsNullOrWhiteSpace(cleanToken))
        {
            activeKey = GetCacheKey(cleanToken, string.Empty);
            _cache.TryGetValue(activeKey, out entry);

            if (entry == null)
            {
                var subToken = cleanToken.StartsWith("tok_") ? cleanToken[4..] : cleanToken;
                var tokenPrefix = subToken.Contains('_') ? subToken.Split('_')[0] : subToken;
                if (!string.IsNullOrEmpty(tokenPrefix))
                {
                    _cache.TryGetValue($"kyc_token_otp_{tokenPrefix}", out entry);
                }
            }
        }

        // Fallback: look up by email if token key missed
        if (entry == null && !string.IsNullOrWhiteSpace(dto.Email))
        {
            activeKey = $"kyc_email_otp_{dto.Email.Trim().ToLower()}";
            _cache.TryGetValue(activeKey, out entry);
        }

        if (entry == null)
        {
            return Task.FromResult(ApiResponse<VerifyKycOtpResponseDto>.ErrorResponse("Verification code has expired or was not requested. Please click Resend Code."));
        }

        // Rate limit check
        if (entry.FailedAttempts >= 5)
        {
            if (!string.IsNullOrEmpty(activeKey)) _cache.Remove(activeKey);
            return Task.FromResult(ApiResponse<VerifyKycOtpResponseDto>.ErrorResponse("Too many incorrect attempts. Please request a new verification code."));
        }

        var inputOtp = dto.Otp.Trim();
        bool isMatch = string.Equals(entry.Otp.Trim(), inputOtp, StringComparison.Ordinal) ||
                       entry.ValidOtps.Any(c => string.Equals(c.Trim(), inputOtp, StringComparison.Ordinal));

        // Compare entered OTP
        if (isMatch)
        {
            // Match success! Remove all alias keys from cache so it cannot be re-used
            if (!string.IsNullOrEmpty(activeKey)) _cache.Remove(activeKey);
            if (!string.IsNullOrEmpty(cleanToken))
            {
                _cache.Remove($"kyc_token_otp_{cleanToken}");
                var subToken = cleanToken.StartsWith("tok_") ? cleanToken[4..] : cleanToken;
                var tokenPrefix = subToken.Contains('_') ? subToken.Split('_')[0] : subToken;
                if (!string.IsNullOrEmpty(tokenPrefix))
                {
                    _cache.Remove($"kyc_token_otp_{tokenPrefix}");
                    _cache.Remove($"kyc_token_otp_tok_{tokenPrefix}");
                }
            }
            if (!string.IsNullOrEmpty(entry.Token) && entry.Token != cleanToken)
            {
                _cache.Remove($"kyc_token_otp_{entry.Token}");
            }
            if (!string.IsNullOrEmpty(entry.Email))
            {
                _cache.Remove($"kyc_email_otp_{entry.Email.ToLowerInvariant()}");
            }

            _logger.LogInformation("[KYC OTP] Identity verified for {Email}", entry.Email);

            return Task.FromResult(ApiResponse<VerifyKycOtpResponseDto>.SuccessResponse(new VerifyKycOtpResponseDto
            {
                Verified = true,
                Message = "Identity verified successfully!",
                Email = entry.Email
            }, "Identity verified successfully!"));
        }

        // Incorrect code
        entry.FailedAttempts++;
        var remaining = 5 - entry.FailedAttempts;
        return Task.FromResult(ApiResponse<VerifyKycOtpResponseDto>.ErrorResponse($"Invalid verification code. {remaining} attempt(s) remaining."));
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

    private static string GetCacheKey(string token, string email)
    {
        if (!string.IsNullOrWhiteSpace(token))
            return $"kyc_token_otp_{token}";
        return $"kyc_email_otp_{email.ToLower()}";
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
