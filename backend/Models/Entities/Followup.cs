using backend.Models.Enums;

namespace backend.Models.Entities;

public class Followup
{
    public int Id { get; set; }

    public int CompanyId { get; set; }
    public Tenant Company { get; set; } = null!;

    // Can be linked to either an Investor (IRM followup) or a Lead (Sales followup)
    public int? InvestorId { get; set; }
    public Investor? Investor { get; set; }
    public string? InvestorName { get; set; }

    // The IRM (or sales exec) assigned to this followup
    public int AssignedToId { get; set; }
    public User AssignedTo { get; set; } = null!;
    public string AssignedToName { get; set; } = string.Empty;
    public string AssignedToRole { get; set; } = string.Empty;   // irm | sales_executive

    public string ContactName { get; set; } = string.Empty;
    public string ContactPhone { get; set; } = string.Empty;
    public string? ContactId { get; set; }   // investor id or lead id

    public DateTime ScheduledAt { get; set; }
    public FollowupStatus Status { get; set; } = FollowupStatus.Pending;

    public string? Agenda { get; set; }
    public string? OutcomeNotes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime? RescheduledTo { get; set; }
}
