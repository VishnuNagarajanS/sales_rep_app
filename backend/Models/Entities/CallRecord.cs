namespace backend.Models.Entities;

public class CallRecord
{
    public int Id { get; set; }

    public int CompanyId { get; set; }
    public Tenant? Company { get; set; }

    public int AgentId { get; set; }
    public User? Agent { get; set; }

    public string ContactName { get; set; } = string.Empty;
    public string ContactPhone { get; set; } = string.Empty;
    public string Direction { get; set; } = "outbound"; // "inbound" | "outbound"
    public int Duration { get; set; } // seconds
    public string Disposition { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;

    public int? LeadId { get; set; }
    public int? CustomerId { get; set; }

    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
