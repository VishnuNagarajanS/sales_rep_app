namespace backend.Services.Interfaces;

public interface IEmailService
{
    /// <summary>
    /// Human-readable reason for the most recent failed send in this request scope (null if it succeeded).
    /// </summary>
    string? LastError { get; }

    /// <summary>
    /// Sends an investor KYC verification link via HTML email.
    /// </summary>
    Task<bool> SendKycVerificationLinkAsync(
        string recipientEmail,
        string recipientName,
        string kycLink,
        string expiryWindow,
        CancellationToken ct = default);

    /// <summary>
    /// Sends a 6-digit real-time KYC OTP verification code via HTML email.
    /// </summary>
    Task<bool> SendKycOtpEmailAsync(
        string recipientEmail,
        string recipientName,
        string otpCode,
        int expiryMinutes = 5,
        CancellationToken ct = default);

    /// <summary>
    /// Sends a password reset link to the user via HTML email.
    /// </summary>
    Task<bool> SendPasswordResetEmailAsync(
        string recipientEmail,
        string recipientName,
        string resetLink,
        int expiryMinutes = 60,
        CancellationToken ct = default);

    /// <summary>
    /// Generic HTML email sending method.
    /// </summary>
    Task<bool> SendEmailAsync(
        string toEmail,
        string subject,
        string htmlBody,
        CancellationToken ct = default);
}
