namespace backend.Models.Entities;

public class BroadcastAnnouncement
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Priority { get; set; } = "info"; // info | warning | critical
    public string TargetAudience { get; set; } = "all"; // all | tenant_admins | sales_reps
    public int? TargetTenantId { get; set; }
    public Tenant? TargetTenant { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ExpiresAt { get; set; }
    public string CreatedBy { get; set; } = "Super Admin";
}
