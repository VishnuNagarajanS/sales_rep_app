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
        }

        var targetEmail = !string.IsNullOrWhiteSpace(dto.Email) 
            ? dto.Email.Trim() 
            : (kyc?.Email ?? "Dhina7269@gmail.com");

        var targetName = kyc?.InvestorName ?? "Investor";

        // 2. Generate 6-digit cryptographic OTP
        var otpCode = RandomNumberGenerator.GetInt32(100000, 1000000).ToString("D6");

        // 3. Cache OTP for 5 minutes
        var cacheKey = GetCacheKey(cleanToken, targetEmail);
        var entry = new CachedOtpEntry
        {
            Otp = otpCode,
            Email = targetEmail,
            Token = cleanToken,
            FailedAttempts = 0
        };

        _cache.Set(cacheKey, entry, TimeSpan.FromMinutes(5));

        // Also cache by email for dual lookup
        _cache.Set($"kyc_email_otp_{targetEmail.ToLower()}", entry, TimeSpan.FromMinutes(5));

        // 4. Dispatch Email via Gmail SMTP
        _logger.LogInformation("==================================================");
        _logger.LogInformation("[KYC OTP GENERATED] Recipient: {Email} | OTP: {Otp} (Valid: 5m)", targetEmail, otpCode);
        _logger.LogInformation("==================================================");

        var emailDelivered = await _emailService.SendKycOtpEmailAsync(targetEmail, targetName, otpCode, 5, ct);

        var masked = MaskEmail(targetEmail);
        var message = emailDelivered 
            ? $"6-digit verification code sent to {masked}" 
            : $"Verification code generated for {masked} (Check server console for OTP)";

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

        if (!string.IsNullOrWhiteSpace(cleanToken))
        {
            activeKey = GetCacheKey(cleanToken, string.Empty);
            _cache.TryGetValue(activeKey, out entry);
        }

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

        // Compare entered OTP
        if (string.Equals(entry.Otp.Trim(), dto.Otp.Trim(), StringComparison.Ordinal))
        {
            // Match success! Remove from cache so it cannot be re-used
            if (!string.IsNullOrEmpty(activeKey)) _cache.Remove(activeKey);
            if (!string.IsNullOrEmpty(entry.Token)) _cache.Remove($"kyc_token_otp_{entry.Token}");
            if (!string.IsNullOrEmpty(entry.Email)) _cache.Remove($"kyc_email_otp_{entry.Email.ToLower()}");

            _logger.LogInformation("[KYC OTP VERIFIED] Successfully verified identity for {Email}", entry.Email);

            return Task.FromResult(ApiResponse<VerifyKycOtpResponseDto>.SuccessResponse(new VerifyKycOtpResponseDto
            {
                Verified = true,
                Message = "Identity verified successfully!"
            }, "Identity verified successfully!"));
        }

        // Incorrect code
        entry.FailedAttempts++;
        var remaining = 5 - entry.FailedAttempts;
        return Task.FromResult(ApiResponse<VerifyKycOtpResponseDto>.ErrorResponse($"Invalid verification code. {remaining} attempt(s) remaining."));
    }

    private async Task<InvestorKyc?> ResolveKycByTokenAsync(string token, CancellationToken ct)
    {
        // 1. Direct match
        var direct = await _kycRepo.GetByTokenAsync(token, ct);
        if (direct != null) return direct;

        // 2. Slug match (e.g. tok_36d49ac8_ramesh)
        var allKycs = await _kycRepo.GetAllAsync(1, null, ct);
        var subToken = token.Replace("tok_", "").Trim();
        var match = allKycs.FirstOrDefault(k =>
            k.KycLinkToken == token ||
            (!string.IsNullOrEmpty(k.KycLinkToken) && subToken.StartsWith(k.KycLinkToken.Substring(0, Math.Min(8, k.KycLinkToken.Length)))) ||
            (!string.IsNullOrEmpty(k.KycLinkToken) && token.Contains(k.KycLinkToken.Substring(0, Math.Min(8, k.KycLinkToken.Length))))
        );

        return match;
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
