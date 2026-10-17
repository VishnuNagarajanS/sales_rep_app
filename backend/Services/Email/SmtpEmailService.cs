using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Configuration;

namespace backend.Services.Email;

public class SmtpEmailService : IEmailService
{
    private readonly IConfiguration _configuration;

    public SmtpEmailService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public async Task SendEmailAsync(string toEmail, string subject, string body, bool isHtml = true)
    {
        var host = _configuration["SmtpSettings:Host"] ?? "smtp.gmail.com";
        var port = int.Parse(_configuration["SmtpSettings:Port"] ?? "587");
        var username = _configuration["SmtpSettings:Username"] ?? "";
        var password = _configuration["SmtpSettings:Password"] ?? "";
        var fromEmail = _configuration["SmtpSettings:FromEmail"]
            ?? _configuration["SmtpSettings:SenderEmail"]
            ?? username;

        if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(password))
        {
            Console.WriteLine("[SMTP] Warning: SMTP credentials are not configured. Email not sent.");
            return;
        }

        try
        {
            using var client = new SmtpClient(host, port)
            {
                Credentials = new NetworkCredential(username, password),
                EnableSsl = true,
                Timeout = 10000 // 10 seconds timeout
            };

            var senderDisplayName = _configuration["SmtpSettings:SenderName"] ?? "GHL India Ventures";
            var mailMessage = new MailMessage
            {
                From = new MailAddress(fromEmail, senderDisplayName),
                Subject = subject,
                Body = body,
                IsBodyHtml = isHtml
            };
            mailMessage.To.Add(toEmail);

            await client.SendMailAsync(mailMessage);
            Console.WriteLine($"[SMTP] Successfully sent email to {toEmail}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[SMTP] Error sending email to {toEmail}: {ex.Message}");
            throw;
        }
    }
}
