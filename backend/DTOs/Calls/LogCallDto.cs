namespace backend.DTOs.Calls;

public class LogCallDto
{
    public string ContactName { get; set; } = string.Empty;
    public string ContactPhone { get; set; } = string.Empty;
    public string Direction { get; set; } = "outbound";
    public int Duration { get; set; }
    public string Disposition { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public int? LeadId { get; set; }
    public int? CustomerId { get; set; }
}
