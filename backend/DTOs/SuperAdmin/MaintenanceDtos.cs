namespace backend.DTOs.SuperAdmin;

public class MaintenanceModeDto
{
    public bool Enabled { get; set; }
    public string Message { get; set; } = "Platform under scheduled maintenance.";
    public string BypassSecret { get; set; } = "nexus-admin-2026";
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
}

public class UpdateMaintenanceModeRequestDto
{
    public bool Enabled { get; set; }
    public string? Message { get; set; }
    public string? BypassSecret { get; set; }
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
}
