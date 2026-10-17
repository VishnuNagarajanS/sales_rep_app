namespace backend.DTOs.SuperAdmin;

public class BackupSnapshotDto
{
    public string Id { get; set; } = string.Empty;
    public string Filename { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string CreatedBy { get; set; } = "Super Admin";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public long FileSizeBytes { get; set; }
    public string FormattedSize { get; set; } = "0 KB";
    public int TotalTables { get; set; }
    public int TotalRecordsCount { get; set; }
    public string ChecksumSha256 { get; set; } = string.Empty;
    public string Status { get; set; } = "Ready";
    public Dictionary<string, int> TableCounts { get; set; } = new();
}

public class GenerateBackupRequestDto
{
    public string? Description { get; set; }
    public bool IncludeAuditLogs { get; set; } = true;
}
