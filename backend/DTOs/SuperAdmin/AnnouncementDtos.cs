namespace backend.DTOs.SuperAdmin;

public class CreateAnnouncementRequestDto
{
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Priority { get; set; } = "info"; // info, warning, critical
    public string TargetAudience { get; set; } = "all"; // all, tenant_admins, sales_reps
    public string? TargetTenantId { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public bool IsActive { get; set; } = true;
}

public class UpdateAnnouncementRequestDto
{
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Priority { get; set; } = "info";
    public string TargetAudience { get; set; } = "all";
    public string? TargetTenantId { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public bool IsActive { get; set; } = true;
}

public class AnnouncementStatusUpdateDto
{
    public bool IsActive { get; set; }
}

public class AnnouncementResponseDto
{
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Priority { get; set; } = "info";
    public string TargetAudience { get; set; } = "all";
    public string? TargetTenantId { get; set; }
    public bool IsActive { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime? ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; }
}
