namespace backend.DTOs.SuperAdmin;

public class SecurityOverviewDto
{
    public int TotalSessions { get; set; }
    public int ActiveSessions { get; set; }
    public int TwoFactorAdoptionCount { get; set; }
    public double TwoFactorAdoptionRate { get; set; }
    public int FailedLogins24h { get; set; }
    public int TotalSecurityEvents { get; set; }
    public List<SecurityEventDto> RecentSecurityEvents { get; set; } = new();
}

public class UserSessionDto
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string UserEmail { get; set; } = string.Empty;
    public string RoleCode { get; set; } = string.Empty;
    public string TokenId { get; set; } = string.Empty;
    public string IpAddress { get; set; } = string.Empty;
    public string UserAgent { get; set; } = string.Empty;
    public string Device { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public bool IsCurrent { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime LastActivityAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public string? RevokedReason { get; set; }
}

public class SecurityEventDto
{
    public int Id { get; set; }
    public string EventType { get; set; } = string.Empty;
    public string Severity { get; set; } = "INFO";
    public string Description { get; set; } = string.Empty;
    public string IpAddress { get; set; } = string.Empty;
    public string? UserEmail { get; set; }
    public int? UserId { get; set; }
    public DateTime Timestamp { get; set; }
    public string? Details { get; set; }
}

public class MfaSetupResponseDto
{
    public string Secret { get; set; } = string.Empty;
    public string QrCodeUri { get; set; } = string.Empty;
    public string ManualEntryKey { get; set; } = string.Empty;
    public List<string> RecoveryCodes { get; set; } = new();
}

public class MfaVerifyRequestDto
{
    public string Code { get; set; } = string.Empty;
}

public class MfaDisableRequestDto
{
    public string Password { get; set; } = string.Empty;
    public string? Code { get; set; }
}

public class TwoFactorLoginVerifyRequestDto
{
    public string TempToken { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
}

public class ChangePasswordRequestDto
{
    public string CurrentPassword { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
    public string ConfirmPassword { get; set; } = string.Empty;
}
