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
    public string Direction { get; set; } = "outbound"; // inbound | outbound
    public int DurationSeconds { get; set; }
    public string Disposition { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public string? RecordingUrl { get; set; }
    public string? Transcription { get; set; }
    public int? TransferredToUserId { get; set; }
    public int TransferCount { get; set; } = 0;
    public string? HangupReason { get; set; }
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>Alias for StartedAt — kept for backwards compat with existing controllers.</summary>
    [NotMapped]
    public DateTime Timestamp
    {
        get => StartedAt;
        set => StartedAt = value;
    }
}

