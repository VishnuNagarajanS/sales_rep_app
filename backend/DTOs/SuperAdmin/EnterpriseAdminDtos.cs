namespace backend.DTOs.SuperAdmin;

public class ServerLogEntryDto
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public string Level { get; set; } = "ERROR";
    public string Method { get; set; } = "GET";
    public string Path { get; set; } = "/";
    public string Message { get; set; } = string.Empty;
    public string? StackTrace { get; set; }
    public string? Source { get; set; }
    public int? StatusCode { get; set; } = 500;
}

public class DatabaseRadarDto
{
    public int ActiveConnections { get; set; }
    public int IdleConnections { get; set; }
    public int TotalConnections { get; set; }
    public int MaxPoolSize { get; set; } = 10;
    public double PoolUtilizationPercent { get; set; }
    public string DatabaseEngine { get; set; } = "PostgreSQL";
    public string DatabaseName { get; set; } = "NexusSalesDb";
    public string Status { get; set; } = "Healthy";
    public int BlockedQueriesCount { get; set; }
    public int IdleInTransaction { get; set; }
    public string TotalDatabaseSize { get; set; } = "14.2 MB";
    public List<TableSizeDto> TableSizes { get; set; } = new();
    public DateTime CheckedAt { get; set; } = DateTime.UtcNow;
}

public class TableSizeDto
{
    public string TableName { get; set; } = string.Empty;
    public long RecordCount { get; set; }
    public string SizeFormatted { get; set; } = "0 KB";
    public long SizeBytes { get; set; }
}

public class BackgroundJobStatusDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Schedule { get; set; } = string.Empty;
    public string Status { get; set; } = "Idle"; // Running, Idle, Failed
    public DateTime? LastRunAt { get; set; }
    public DateTime? NextRunAt { get; set; }
    public long LastDurationMs { get; set; }
    public int TotalRunsCount { get; set; }
    public int ProcessedItemsCount { get; set; }
    public string? LastError { get; set; }
    public bool CanTriggerManually { get; set; } = true;
}

public class EmergencyLockdownStatusDto
{
    public bool IsActive { get; set; }
    public string? Reason { get; set; }
    public string? InitiatedBy { get; set; }
    public DateTime? InitiatedAt { get; set; }
    public int RevokedSessionsCount { get; set; }
}

public class EmergencyLockdownRequestDto
{
    public string Reason { get; set; } = "Emergency security audit and incident mitigation.";
}
