using System.Net;
using System.Net.Mail;
using backend.Configuration;
using backend.Services.Interfaces;
using Microsoft.Extensions.Options;

namespace backend.Services.Implementations;

public class EmailService : IEmailService
{
    private readonly IOptionsMonitor<SmtpSettings> _optionsMonitor;
    private readonly ILogger<EmailService> _logger;

    private SmtpSettings Settings => _optionsMonitor.CurrentValue;

    public string? LastError { get; private set; }

    public EmailService(IOptionsMonitor<SmtpSettings> optionsMonitor, ILogger<EmailService> logger)
    {
        _optionsMonitor = optionsMonitor;
        _logger = logger;
    }

    public async Task<bool> SendKycVerificationLinkAsync(
        string recipientEmail,
        string recipientName,
        string kycLink,
        string expiryWindow,
        CancellationToken ct = default)
    {
        var subject = $"Your KYC Onboarding Link - GHL India Ventures";

        var body = $@"
<!DOCTYPE html>
<html lang=""en"">
<head>
  <meta charset=""UTF-8"">
  <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
  <title>KYC Verification</title>
</head>
<body style=""margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;"">
  <table role=""presentation"" border=""0"" cellpadding=""0"" cellspacing=""0"" width=""100%"" style=""background-color: #f1f5f9; padding: 40px 10px;"">
    <tr>
      <td align=""center"">
        <table role=""presentation"" border=""0"" cellpadding=""0"" cellspacing=""0"" width=""100%"" style=""max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);"">
          <!-- Header -->
          <tr>
            <td style=""background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 40px; text-align: left; border-bottom: 3px solid #0284c7;"">
              <div style=""display: inline-block; background-color: #0284c7; color: #ffffff; font-weight: 800; font-size: 14px; padding: 4px 10px; border-radius: 6px; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 8px;"">
                NexusSales Platform
              </div>
              <h1 style=""margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;"">
                GHL India Ventures
              </h1>
              <p style=""margin: 6px 0 0 0; color: #94a3b8; font-size: 13px;"">
                Institutional Wealth & Regulatory Compliance
              </p>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style=""padding: 40px;"">
              <h2 style=""margin: 0 0 16px 0; color: #0f172a; font-size: 18px; font-weight: 600;"">
                Dear {WebUtility.HtmlEncode(recipientName)},
              </h2>
              <p style=""margin: 0 0 20px 0; color: #475569; font-size: 15px; line-height: 1.6;"">
                You have been invited by your <strong>Investor Relations Manager</strong> to complete your qualified investor regulatory onboarding and KYC verification for GHL India Ventures.
              </p>
              
              <div style=""background-color: #f8fafc; border-left: 4px solid #0284c7; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 28px;"">
                <p style=""margin: 0; color: #334155; font-size: 14px; line-height: 1.5;"">
                  <strong>Verification Requirements:</strong><br>
                  • Identity Proof (PAN & Aadhaar number)<br>
                  • Bank Account Details (IFSC code & account number)<br>
                  • Demat / Depository Details (if applicable)<br>
                  • Live Selfie & Verification Consent
                </p>
              </div>

              <!-- Button CTA -->
              <table role=""presentation"" border=""0"" cellpadding=""0"" cellspacing=""0"" width=""100%"" style=""margin-bottom: 28px;"">
                <tr>
                  <td align=""center"">
                    <a href=""{kycLink}"" target=""_blank"" style=""display: inline-block; background-color: #0284c7; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px; box-shadow: 0 2px 4px rgba(2, 132, 199, 0.4);"">
                      Complete KYC Verification &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style=""margin: 0 0 8px 0; color: #64748b; font-size: 13px;"">
                Or copy and paste this secure link directly into your browser:
              </p>
              <p style=""margin: 0 0 24px 0; word-break: break-all; background-color: #f1f5f9; padding: 10px 14px; border-radius: 6px; font-size: 12px; color: #0284c7;"">
                <a href=""{kycLink}"" style=""color: #0284c7; text-decoration: none;"">{kycLink}</a>
              </p>

              <!-- Expiry Alert -->
              <table role=""presentation"" border=""0"" cellpadding=""0"" cellspacing=""0"" width=""100%"" style=""background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 12px;"">
                <tr>
                  <td style=""color: #92400e; font-size: 13px; line-height: 1.4;"">
                    ⏱ <strong>Security Notice:</strong> This link is unique to you and will expire in <strong>{WebUtility.HtmlEncode(expiryWindow)}</strong>. Please do not share or forward this link to anyone.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style=""background-color: #f8fafc; padding: 24px 40px; text-align: center; border-top: 1px solid #e2e8f0;"">
              <p style=""margin: 0 0 6px 0; color: #64748b; font-size: 12px;"">
                GHL India Ventures • Institutional Real Estate & Wealth Advisory
              </p>
              <p style=""margin: 0; color: #94a3b8; font-size: 11px;"">
                This is an automated security dispatch. If you did not expect this request, please contact your relationship manager immediately.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
";

        return await SendEmailAsync(recipientEmail, subject, body, ct);
    }

    public async Task<bool> SendKycOtpEmailAsync(
        string recipientEmail,
        string recipientName,
        string otpCode,
        int expiryMinutes = 5,
        CancellationToken ct = default)
    {
        var subject = $"Your KYC Verification Passcode: {otpCode} - GHL India Ventures";

        var body = $@"
<!DOCTYPE html>
<html lang=""en"">
<head>
  <meta charset=""UTF-8"">
  <title>KYC Verification Code</title>
</head>
<body style=""margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;"">
  <table role=""presentation"" border=""0"" cellpadding=""0"" cellspacing=""0"" width=""100%"" style=""background-color: #f1f5f9; padding: 40px 10px;"">
    <tr>
      <td align=""center"">
        <table role=""presentation"" border=""0"" cellpadding=""0"" cellspacing=""0"" width=""100%"" style=""max-width: 520px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);"">
          <!-- Header -->
          <tr>
            <td style=""background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 28px 36px; text-align: left; border-bottom: 3px solid #0284c7;"">
              <div style=""display: inline-block; background-color: #0284c7; color: #ffffff; font-weight: 800; font-size: 12px; padding: 3px 8px; border-radius: 4px; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 6px;"">
                NexusSales Security
              </div>
              <h1 style=""margin: 0; color: #ffffff; font-size: 20px; font-weight: 700;"">
                GHL India Ventures
              </h1>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style=""padding: 36px;"">
              <h2 style=""margin: 0 0 12px 0; color: #0f172a; font-size: 17px; font-weight: 600;"">
                Hello {WebUtility.HtmlEncode(recipientName)},
              </h2>
              <p style=""margin: 0 0 20px 0; color: #475569; font-size: 14px; line-height: 1.5;"">
                We received a request to verify your identity for your <strong>Qualified Investor Regulatory KYC Onboarding</strong>. Use the 6-digit one-time passcode below to proceed:
              </p>

              <!-- OTP Code Display Box -->
              <table role=""presentation"" border=""0"" cellpadding=""0"" cellspacing=""0"" width=""100%"" style=""margin: 24px 0;"">
                <tr>
                  <td align=""center"" style=""background-color: #f0f9ff; border: 2px dashed #0284c7; border-radius: 10px; padding: 20px;"">
                    <span style=""font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 800; letter-spacing: 12px; color: #0284c7;"">
                      {otpCode}
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Expiry Alert -->
              <p style=""margin: 0 0 20px 0; color: #64748b; font-size: 13px; text-align: center;"">
                ⏱ This passcode will expire in <strong>{expiryMinutes} minutes</strong>.
              </p>

              <div style=""background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 6px; padding: 12px; font-size: 12px; color: #92400e;"">
                🔒 <strong>Security Tip:</strong> Never share your verification code or login link with anyone. GHL representatives will never ask for your one-time passcode.
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style=""background-color: #f8fafc; padding: 20px 36px; text-align: center; border-top: 1px solid #e2e8f0;"">
              <p style=""margin: 0; color: #94a3b8; font-size: 11px;"">
                GHL India Ventures • Institutional Real Estate & Wealth Advisory
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
";

        return await SendEmailAsync(recipientEmail, subject, body, ct);
    }

    public async Task<bool> SendPasswordResetEmailAsync(
        string recipientEmail,
        string recipientName,
        string resetLink,
        int expiryMinutes = 60,
        CancellationToken ct = default)
    {
        var subject = "Reset Your Password - NexusSales Platform";
        var displayName = string.IsNullOrWhiteSpace(recipientName) ? "there" : recipientName.Trim();

        var body = $@"
<!DOCTYPE html>
<html lang=""en"">
<head>
  <meta charset=""UTF-8"">
  <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
  <title>Reset Your Password</title>
</head>
<body style=""margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;"">
  <table role=""presentation"" border=""0"" cellpadding=""0"" cellspacing=""0"" width=""100%"" style=""background-color: #f1f5f9; padding: 40px 10px;"">
    <tr>
      <td align=""center"">
        <table role=""presentation"" border=""0"" cellpadding=""0"" cellspacing=""0"" width=""100%"" style=""max-width: 580px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);"">
          <!-- Header -->
          <tr>
            <td style=""background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 40px; text-align: left; border-bottom: 3px solid #0284c7;"">
              <div style=""display: inline-block; background-color: #0284c7; color: #ffffff; font-weight: 800; font-size: 13px; padding: 4px 10px; border-radius: 6px; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 8px;"">
                NexusSales Security
              </div>
              <h1 style=""margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;"">
                Password Reset Request
              </h1>
              <p style=""margin: 6px 0 0 0; color: #94a3b8; font-size: 13px;"">
                Secure Account Recovery
              </p>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style=""padding: 36px 40px;"">
              <h2 style=""margin: 0 0 16px 0; color: #0f172a; font-size: 18px; font-weight: 600;"">
                Hello {WebUtility.HtmlEncode(displayName)},
              </h2>
              <p style=""margin: 0 0 16px 0; color: #475569; font-size: 15px; line-height: 1.6;"">
                We received a request to reset the password for your NexusSales Platform account associated with <strong>{WebUtility.HtmlEncode(recipientEmail)}</strong>.
              </p>
              <p style=""margin: 0 0 28px 0; color: #475569; font-size: 15px; line-height: 1.6;"">
                Click the button below to choose a new password. This link is single-use and will expire in <strong>{expiryMinutes} minutes</strong>.
              </p>

              <!-- Button CTA -->
              <table role=""presentation"" border=""0"" cellpadding=""0"" cellspacing=""0"" width=""100%"" style=""margin-bottom: 28px;"">
                <tr>
                  <td align=""center"">
                    <a href=""{resetLink}"" target=""_blank"" style=""display: inline-block; background-color: #0284c7; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 34px; border-radius: 8px; box-shadow: 0 2px 4px rgba(2, 132, 199, 0.4);"">
                      Reset Password &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style=""margin: 0 0 8px 0; color: #64748b; font-size: 13px;"">
                If the button above does not work, copy and paste this link into your browser:
              </p>
              <p style=""margin: 0 0 24px 0; word-break: break-all; background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 10px 14px; border-radius: 6px; font-size: 12px; color: #0284c7;"">
                <a href=""{resetLink}"" style=""color: #0284c7; text-decoration: none;"">{resetLink}</a>
              </p>

              <!-- Security Notice -->
              <div style=""background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px; padding: 14px 16px; margin-top: 24px;"">
                <p style=""margin: 0; color: #991b1b; font-size: 13px; line-height: 1.5;"">
                  <strong>Did not request this?</strong> If you didn't ask to reset your password, you can safely ignore this email. Your current password will remain unchanged and your account is secure.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style=""background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 40px; text-align: center;"">
              <p style=""margin: 0 0 4px 0; color: #64748b; font-size: 12px;"">
                NexusSales Multi-Tenant Platform &bull; Automated Security Service
              </p>
              <p style=""margin: 0; color: #94a3b8; font-size: 11px;"">
                This is an automated system email. Please do not reply directly to this message.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
";

        return await SendEmailAsync(recipientEmail, subject, body, ct);
    }

    public async Task<bool> SendEmailAsync(
        string toEmail,
        string subject,
        string htmlBody,
        CancellationToken ct = default)
    {
        LastError = null;

        // 1. Validate recipient email address format
        var trimmedRecipient = toEmail?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(trimmedRecipient) || !MailAddress.TryCreate(trimmedRecipient, out var recipientAddr) || string.IsNullOrWhiteSpace(recipientAddr.Host) || !recipientAddr.Address.Contains('@'))
        {
            _logger.LogWarning("Email sending skipped: recipient email '{Recipient}' is invalid.", toEmail);
            LastError = $"The specified recipient email address '{toEmail}' is not in the form required for an email address.";
            return false;
        }

        var cfg = Settings;

        // Resolve SMTP configuration, prioritizing secure environment-based secrets
        var effectiveUsername = (!string.IsNullOrWhiteSpace(cfg.Username) ? cfg.Username : (Environment.GetEnvironmentVariable("SMTP_USERNAME") ?? Environment.GetEnvironmentVariable("SmtpSettings__Username")))?.Trim() ?? string.Empty;
        var effectivePassword = (!string.IsNullOrWhiteSpace(cfg.Password) ? cfg.Password : (Environment.GetEnvironmentVariable("SMTP_PASSWORD") ?? Environment.GetEnvironmentVariable("SmtpSettings__Password")))?.Replace(" ", "").Trim() ?? string.Empty;
        var effectiveSender = (!string.IsNullOrWhiteSpace(cfg.SenderEmail) ? cfg.SenderEmail : (Environment.GetEnvironmentVariable("SMTP_SENDER_EMAIL") ?? Environment.GetEnvironmentVariable("SmtpSettings__SenderEmail")))?.Trim() ?? string.Empty;
        var effectiveHost = (!string.IsNullOrWhiteSpace(cfg.Host) ? cfg.Host : (Environment.GetEnvironmentVariable("SMTP_HOST") ?? Environment.GetEnvironmentVariable("SmtpSettings__Host")))?.Trim() ?? "smtp.gmail.com";
        var portVal = Environment.GetEnvironmentVariable("SMTP_PORT") ?? Environment.GetEnvironmentVariable("SmtpSettings__Port");
        var effectivePort = int.TryParse(portVal, out var p) && p > 0 ? p : (cfg.Port > 0 ? cfg.Port : 587);
        var senderDisplayName = (!string.IsNullOrWhiteSpace(cfg.SenderName) ? cfg.SenderName : (Environment.GetEnvironmentVariable("SMTP_SENDER_NAME") ?? Environment.GetEnvironmentVariable("SmtpSettings__SenderName")))?.Trim() ?? "NexusSales IRM Compliance";

        // If Username is empty but SenderEmail is provided (or vice-versa), unify them
        if (string.IsNullOrWhiteSpace(effectiveUsername) && !string.IsNullOrWhiteSpace(effectiveSender))
        {
            effectiveUsername = effectiveSender;
        }
        else if (string.IsNullOrWhiteSpace(effectiveSender) && !string.IsNullOrWhiteSpace(effectiveUsername))
        {
            effectiveSender = effectiveUsername;
        }

        // 2. Validate SMTP credentials configuration (detect empty or placeholder values)
        if (string.IsNullOrWhiteSpace(effectiveUsername) || 
            effectiveUsername.StartsWith("YOUR_SMTP", StringComparison.OrdinalIgnoreCase) ||
            string.IsNullOrWhiteSpace(effectivePassword) ||
            effectivePassword.StartsWith("YOUR_SMTP", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Email delivery failed: SMTP credentials are not configured in environment secrets or SmtpSettings.");
            LastError = "SMTP service is not configured. Please configure valid SMTP credentials via environment secrets (SMTP_USERNAME and SMTP_PASSWORD or SmtpSettings:Username and SmtpSettings:Password).";
            return false;
        }

        // 3. Resolve and validate sender email address format
        MailAddress? fromAddr = null;
        if (!string.IsNullOrWhiteSpace(effectiveSender) && MailAddress.TryCreate(effectiveSender, out var parsedSender) && !string.IsNullOrWhiteSpace(parsedSender.Host) && parsedSender.Address.Contains('@'))
        {
            fromAddr = parsedSender;
        }
        else if (MailAddress.TryCreate(effectiveUsername, out var parsedUser) && !string.IsNullOrWhiteSpace(parsedUser.Host) && parsedUser.Address.Contains('@'))
        {
            fromAddr = parsedUser;
        }

        if (fromAddr == null)
        {
            _logger.LogWarning("Email delivery failed: neither SmtpSettings:SenderEmail / SMTP_SENDER_EMAIL ('{Sender}') nor Username ('{User}') is a valid email address.", effectiveSender, effectiveUsername);
            LastError = $"The configured SMTP sender address is not in the form required for an email address. Please configure a valid email in environment secrets (SMTP_SENDER_EMAIL / SMTP_USERNAME).";
            return false;
        }

        try
        {
            using var client = new SmtpClient(effectiveHost, effectivePort)
            {
                EnableSsl = cfg.EnableSsl,
                Credentials = new NetworkCredential(effectiveUsername, effectivePassword),
                DeliveryMethod = SmtpDeliveryMethod.Network,
                Timeout = 15000 // 15 seconds
            };

            using var mail = new MailMessage
            {
                From = new MailAddress(fromAddr.Address, senderDisplayName),
                Subject = subject,
                Body = htmlBody,
                IsBodyHtml = true
            };

            mail.To.Add(recipientAddr);

            _logger.LogInformation("Dispatching real-time email via {Host}:{Port} as {Sender} to {Recipient}...", cfg.Host, cfg.Port, fromAddr.Address, recipientAddr.Address);
            await client.SendMailAsync(mail, ct);
            _logger.LogInformation("Email successfully delivered to {Recipient}!", recipientAddr.Address);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to deliver email to {Recipient} via {Host}:{Port} (User: {User})", recipientAddr.Address, cfg.Host, cfg.Port, effectiveUsername);
            var raw = ex.Message ?? string.Empty;
            var looksLikeAuth = raw.Contains("5.7.", StringComparison.OrdinalIgnoreCase)
                || raw.Contains("535", StringComparison.OrdinalIgnoreCase)
                || raw.Contains("Authentication", StringComparison.OrdinalIgnoreCase)
                || raw.Contains("Username and Password not accepted", StringComparison.OrdinalIgnoreCase);
            LastError = looksLikeAuth
                ? "Gmail rejected the login. Check SmtpSettings:Username and use a valid 16-character Google App Password (2-Step Verification must be ON)."
                : $"SMTP error ({ex.GetType().Name}): {raw}";
            return false;
        }
    }
}
