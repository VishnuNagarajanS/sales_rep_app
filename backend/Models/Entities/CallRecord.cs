using System.ComponentModel.DataAnnotations.Schema;

namespace backend.Models.Entities;

public class CallRecord
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public int AgentId { get; set; }
    public User Agent { get; set; } = null!;
    public int? LeadId { get; set; }
    public int? CustomerId { get; set; }
    public string ContactName { get; set; } = string.Empty;
    public string ContactPhone { get; set; } = string.Empty;
    public string Direction { get; set; } = "outbound";
    public int DurationSeconds { get; set; }
    [NotMapped]
    public int Duration
    {
        get => DurationSeconds;
        set => DurationSeconds = value;
    }
    public string Disposition { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    [NotMapped]
    public DateTime Timestamp
    {
        get => StartedAt;
        set => StartedAt = value;
    }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
