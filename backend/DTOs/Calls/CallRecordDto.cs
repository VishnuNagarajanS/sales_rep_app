namespace backend.DTOs.Calls;

public class CallRecordDto
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
    public DateTime StartedAt
    {
        get => Timestamp;
        set => Timestamp = value;
    }
    public DateTime CreatedAt { get; set; }
}

public class CallRecordResponseDto : CallRecordDto
{
}
