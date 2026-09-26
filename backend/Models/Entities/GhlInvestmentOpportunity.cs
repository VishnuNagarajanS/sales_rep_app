namespace backend.Models.Entities;

/// <summary>
/// GHL India Ventures – Investment opportunity linked to an HNW investor.
/// Tracks the full lifecycle from initial Enquiry → Qualified → Committed → Closed.
/// Each opportunity has a target amount and committed amount in INR.
/// </summary>
public class GhlInvestmentOpportunity
{
    public int Id { get; set; }

    public int CompanyId { get; set; }
    public Tenant? Company { get; set; }

    /// <summary>FK to GhlInvestors table – the investor this opportunity belongs to.</summary>
    public int InvestorId { get; set; }
    public GhlInvestor? Investor { get; set; }

    public int AssignedAgentId { get; set; }
    public User? AssignedAgent { get; set; }

    /// <summary>Opportunity title / fund name (e.g. "AIF Category II – Fund IV").</summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>
    /// Opportunity stage:
    /// Enquiry | Contacted | Consultation | Qualified | Opportunity | Committed | Closed Won | Closed Lost
    /// </summary>
    public string Stage { get; set; } = "Enquiry";

    /// <summary>Target investment amount in INR.</summary>
    public decimal TargetAmount { get; set; } = 0;

    /// <summary>Amount actually committed / signed in INR.</summary>
    public decimal CommittedAmount { get; set; } = 0;

    /// <summary>Expected close date (ISO date string).</summary>
    public string ExpectedCloseDate { get; set; } = string.Empty;

    public string Notes { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
