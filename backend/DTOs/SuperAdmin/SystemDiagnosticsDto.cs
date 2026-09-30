namespace backend.DTOs.SuperAdmin;

public class SystemDiagnosticsDto
{
    public string ApiStatus { get; set; } = "Healthy";
    public double ApiLatencyMs { get; set; }
    public int DbPoolActive { get; set; }
    public int DbPoolMax { get; set; }
    public double DbLatencyMs { get; set; }
    public double MemoryUsedMb { get; set; }
    public double MemoryLimitMb { get; set; }
    public double StorageUsedGb { get; set; }
    public double StorageLimitGb { get; set; }
    public int ActiveSessions { get; set; }
    public int ActiveWebSockets { get; set; }
    public double TelephonyDropRate { get; set; }
    public double SystemUptimePercentage { get; set; }
    public string LastBackupAt { get; set; } = string.Empty;
    public bool DatabaseConnected { get; set; } = true;
    public string ServerTimeUtc { get; set; } = string.Empty;
    public string AppVersion { get; set; } = "NexusSales Enterprise v2.4";
}
