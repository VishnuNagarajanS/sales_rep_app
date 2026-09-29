namespace backend.DTOs.SuperAdmin;

public class SystemDiagnosticsDto
{
    public string ApiStatus { get; set; } = "Healthy";
    public int ApiLatencyMs { get; set; } = 18;
    public int DbPoolActive { get; set; } = 14;
    public int DbPoolMax { get; set; } = 60;
    public int DbLatencyMs { get; set; } = 6;
    public long MemoryUsedMb { get; set; } = 428;
    public long MemoryLimitMb { get; set; } = 2048;
    public double StorageUsedGb { get; set; } = 8.4;
    public double StorageLimitGb { get; set; } = 250;
    public int ActiveSessions { get; set; } = 38;
    public int ActiveWebSockets { get; set; } = 19;
    public double TelephonyDropRate { get; set; } = 0.0;
    public double SystemUptimePercentage { get; set; } = 99.98;
    public string LastBackupAt { get; set; } = string.Empty;
}

public class BroadcastAnnouncementDto
{
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Priority { get; set; } = "info"; // info | warning | critical
    public string TargetAudience { get; set; } = "all"; // all | tenant_admins | sales_reps
    public string? TargetTenantId { get; set; }
    public string? TargetTenantName { get; set; }
    public bool IsActive { get; set; }
    public string CreatedAt { get; set; } = string.Empty;
    public string? ExpiresAt { get; set; }
    public string CreatedBy { get; set; } = "Super Admin";
}

public class CreateAnnouncementDto
{
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Priority { get; set; } = "info";
    public string TargetAudience { get; set; } = "all";
    public string? TargetTenantId { get; set; }
    public string? ExpiresAt { get; set; }
}

public class MaintenanceStatusDto
{
    public bool Enabled { get; set; }
    public string Message { get; set; } = "Platform under scheduled maintenance.";
    public string BypassSecret { get; set; } = "nexus-admin-2026";
}

public class SetMaintenanceDto
{
    public bool Enabled { get; set; }
    public string? Message { get; set; }
    public string? BypassSecret { get; set; }
}
