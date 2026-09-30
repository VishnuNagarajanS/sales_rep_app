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
        var fromEmail = _configuration["SmtpSettings:FromEmail"] ?? username;

        if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(password))
        {
            Console.WriteLine("[SMTP] Warning: SMTP credentials are not configured. Email not sent.");
            return;
        }

        using var client = new SmtpClient(host, port)
        {
            Credentials = new NetworkCredential(username, password),
            EnableSsl = true
        };

        var mailMessage = new MailMessage
        {
            From = new MailAddress(fromEmail),
            Subject = subject,
            Body = body,
            IsBodyHtml = isHtml
        };
        mailMessage.To.Add(toEmail);

        await client.SendMailAsync(mailMessage);
    }
}
