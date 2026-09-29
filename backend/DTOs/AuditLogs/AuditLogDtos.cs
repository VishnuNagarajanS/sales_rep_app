namespace backend.DTOs.AuditLogs;

public class AuditLogResponseDto
{
    public int Id { get; set; }
    public int? CompanyId { get; set; }
    public DateTime Timestamp { get; set; }
    public string ActorName { get; set; } = string.Empty;
    public string ActorEmail { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public string EntityId { get; set; } = string.Empty;
    public string Details { get; set; } = string.Empty;
    public string? IpAddress { get; set; }
    public string? Module { get; set; }
    public string Status { get; set; } = string.Empty;
}
