using System;

namespace backend.DTOs.SuperAdmin;

public class GlobalConfigDto
{
    public string PlatformName { get; set; } = "NexusSales Enterprise";
    public string SupportEmail { get; set; } = "support@ghlindiaventures.com";
    public string DefaultTimezone { get; set; } = "Asia/Kolkata (IST)";
    public int SessionTimeoutMinutes { get; set; } = 60;
    public int MaxUploadSizeMb { get; set; } = 25;
    public bool EnforceMfa { get; set; } = false;
    public int TokenExpirationMinutes { get; set; } = 60;
    public int PasswordMinLength { get; set; } = 8;
    public int RecordingRetentionDays { get; set; } = 90;
    public string SmtpHost { get; set; } = string.Empty;
    public int SmtpPort { get; set; } = 587;
    public bool SmtpEnableSsl { get; set; } = true;
    public string SmtpSenderEmail { get; set; } = string.Empty;
    public string SmtpSenderName { get; set; } = string.Empty;
    public string DatabaseEngine { get; set; } = "PostgreSQL (Neon Cloud)";
    public DateTime? LastUpdatedAt { get; set; }
    public string? LastUpdatedBy { get; set; }
}

public class UpdateGlobalConfigRequestDto
{
    public string? PlatformName { get; set; }
    public string? SupportEmail { get; set; }
    public string? DefaultTimezone { get; set; }
    public int? SessionTimeoutMinutes { get; set; }
    public int? MaxUploadSizeMb { get; set; }
    public bool? EnforceMfa { get; set; }
    public int? TokenExpirationMinutes { get; set; }
    public int? PasswordMinLength { get; set; }
    public int? RecordingRetentionDays { get; set; }
    public string? SmtpSenderEmail { get; set; }
    public string? SmtpSenderName { get; set; }
}
