namespace backend.Models.Entities;

/// <summary>
/// Represents one investor card on the IRM Pipeline Kanban board.
/// IRM stages for GHL: leads → followup → qualified_investor → investment_opportunity → converted
/// </summary>
public class IrmPipelineCard
{
    public int Id { get; set; }

    public int CompanyId { get; set; }
    public Tenant Company { get; set; } = null!;

    public int InvestorId { get; set; }
    public Investor Investor { get; set; } = null!;

    // IRM assigned to this card
    public int AssignedIrmId { get; set; }
    public User AssignedIrm { get; set; } = null!;
    public string AssignedIrmName { get; set; } = string.Empty;

    public int? HandoverId { get; set; }
    public WorkHandover? Handover { get; set; }
    public int? OriginalOwnerId { get; set; }
    public User? OriginalOwner { get; set; }

    public string InvestorName { get; set; } = string.Empty;
    public string InvestorPhone { get; set; } = string.Empty;
    public string InvestorEmail { get; set; } = string.Empty;

    // Stage: leads | followup | qualified_investor | investment_opportunity | converted
    public string StageId { get; set; } = "leads";
    public DateTime StageEnteredAt { get; set; } = DateTime.UtcNow;

    public string? LastActionSnippet { get; set; }
    public DateTime? LastActivityDate { get; set; }

    public string Priority { get; set; } = "Medium";  // High | Medium | Low
    public decimal? Value { get; set; }
    public string? InvestmentAmount { get; set; }
    public string? PreferredAssetClass { get; set; }

    // Stage activity log stored as JSON
    public string? ActivityLogsJson { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
