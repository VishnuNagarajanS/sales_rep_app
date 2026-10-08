using System.ComponentModel.DataAnnotations.Schema;
using backend.Models.Enums;

namespace backend.Models.Entities;

public class Followup
{
    public int Id { get; set; }

    public int CompanyId { get; set; }
    public Tenant? Company { get; set; }

    public int? AssignedAgentId { get; set; }
    public User? AssignedAgent { get; set; }

    [NotMapped]
    public int? UserId
    {
        get => AssignedAgentId;
        set => AssignedAgentId = value;
    }

    [NotMapped]
    public int? AssignedToId
    {
        get => AssignedAgentId;
        set => AssignedAgentId = value;
    }

    [NotMapped]
    public User? AssignedTo
    {
        get => AssignedAgent;
        set => AssignedAgent = value;
    }

    public string AssignedToName { get; set; } = string.Empty;
    public string AssignedToRole { get; set; } = string.Empty; // irm | sales_executive

    // Can be linked to either an Investor (IRM followup) or a Lead (Sales followup)
    public int? InvestorId { get; set; }
    public Investor? Investor { get; set; }
    public string? InvestorName { get; set; }

    public int? LeadId { get; set; }
    public Lead? Lead { get; set; }

    public int? CustomerId { get; set; }
    public Customer? Customer { get; set; }

    public string ContactId { get; set; } = string.Empty;
    public string ContactType { get; set; } = "lead"; // "lead" | "customer" | "investor"
    public string ContactName { get; set; } = string.Empty;
    public string ContactPhone { get; set; } = string.Empty;

    public DateTime ScheduledAt { get; set; }
    public string Priority { get; set; } = "Medium"; // Low, Medium, High, Urgent
    public FollowupStatus Status { get; set; } = FollowupStatus.Pending;
    public string Notes { get; set; } = string.Empty;
    public string? FollowupType { get; set; } = "call";

    public string? Agenda { get; set; }
    public string? OutcomeNotes { get; set; }

    public DateTime? CompletedAt { get; set; }
    public DateTime? RescheduledTo { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
