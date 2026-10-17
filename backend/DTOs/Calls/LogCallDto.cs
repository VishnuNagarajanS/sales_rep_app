namespace backend.DTOs.Calls;

public class LogCallDto
{
    public string ContactName { get; set; } = string.Empty;
    public string ContactPhone { get; set; } = string.Empty;
    public string Direction { get; set; } = "outbound";
    public int Duration { get; set; }
    public string Disposition { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public string? Reason { get; set; }
    public string? Module { get; set; }
    public int? LeadId { get; set; }
    public int? CustomerId { get; set; }
    /// <summary>Twilio Call SID (CAxxxx) to correlate with Twilio's records.</summary>
    public string? TwilioCallSid { get; set; }
}
