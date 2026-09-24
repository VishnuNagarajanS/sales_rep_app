namespace backend.DTOs.Calls;

public class CallRecordDto
{
    public int Id { get; init; }
    public string ContactName { get; init; } = string.Empty;
    public string ContactPhone { get; init; } = string.Empty;
    public string Direction { get; init; } = string.Empty;
    public int Duration { get; init; }
    public string Disposition { get; init; } = string.Empty;
    public string? Notes { get; init; }
    public int? LeadId { get; init; }
    public int? CustomerId { get; init; }
    public DateTime StartedAt { get; init; }
}

public class CallRecordResponseDto
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public int AgentId { get; set; }
    public string? AgentName { get; set; }
    public string ContactName { get; set; } = string.Empty;
    public string ContactPhone { get; set; } = string.Empty;
    public string Direction { get; set; } = "outbound";
    public int Duration { get; set; }
    public string Disposition { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public int? LeadId { get; set; }
    public int? CustomerId { get; set; }
    public DateTime Timestamp { get; set; }
    public DateTime CreatedAt { get; set; }
}
