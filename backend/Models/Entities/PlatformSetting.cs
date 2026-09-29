namespace backend.Models.Entities;

public class PlatformSetting
{
    public int Id { get; set; } = 1;
    public bool MaintenanceModeEnabled { get; set; } = false;
    public string MaintenanceMessage { get; set; } = "Platform under scheduled maintenance.";
    public string BypassSecret { get; set; } = "nexus-admin-2026";
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
