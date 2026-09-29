using backend.Models.Enums;

namespace backend.Models.Entities;

/// <summary>
/// Investor call records — distinct from general CRM calls; scoped to IRM workflow.
/// </summary>
public class InvestorCall
{
    public int Id { get; set; }

    public int CompanyId { get; set; }
    public Tenant Company { get; set; } = null!;

    public int InvestorId { get; set; }
    public Investor Investor { get; set; } = null!;

    // IRM who made/received the call
    public int IrmId { get; set; }
    public User Irm { get; set; } = null!;
    public string IrmName { get; set; } = string.Empty;

    public string InvestorName { get; set; } = string.Empty;
    public string InvestorPhone { get; set; } = string.Empty;

    public DateTime CalledAt { get; set; } = DateTime.UtcNow;
    public int DurationSeconds { get; set; } = 0;

    public CallOutcome Outcome { get; set; }
    public string? Notes { get; set; }
    public string? RecordingUrl { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
