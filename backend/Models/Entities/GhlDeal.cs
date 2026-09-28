namespace backend.Models.Entities;

/// <summary>
/// GHL India Ventures – Sales / Investment pipeline deal.
/// Linked to a Customer (converted lead) and an agent.
/// Stage drives the Kanban / Pipeline board for both
/// Sales Executives (GHL pipeline stages) and IRM officers (IRM stages).
/// </summary>
public class GhlDeal
{
    public int Id { get; set; }

    public int CompanyId { get; set; }
    public Tenant? Company { get; set; }

    public int AssignedAgentId { get; set; }
    public User? AssignedAgent { get; set; }

    /// <summary>Deal title / label shown on the Kanban card.</summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>Linked customer DB ID (from Customers table, optional).</summary>
    public int? CustomerId { get; set; }
    public Customer? Customer { get; set; }

    /// <summary>Denormalised customer name for fast display without JOIN.</summary>
    public string CustomerName { get; set; } = string.Empty;

    /// <summary>
    /// Pipeline stage key. GHL stages: new, contacted, qualified_investor,
    /// investment_opportunity, converted, lost.
    /// IRM stages: leads, followup, qualified_investor, investment_opportunity, converted.
    /// </summary>
    public string Stage { get; set; } = "new";

    /// <summary>Monetary value of this deal in INR (paise stored as decimal).</summary>
    public decimal Value { get; set; } = 0;

    /// <summary>
    /// Free-text expected close date (e.g. "30 Days", "Q4 FY26") or ISO date string.
    /// </summary>
    public string ExpectedCloseDate { get; set; } = string.Empty;

    public string Notes { get; set; } = string.Empty;

    /// <summary>Reason why deal was moved to 'lost' stage.</summary>
    public string? LostReason { get; set; }

    /// <summary>Optional: asset class preference (AIF / CO-AIF).</summary>
    public string? InvestorType { get; set; }

    /// <summary>Optional: investment range label shown in green on the card.</summary>
    public string? InvestmentRange { get; set; }

    /// <summary>Optional: preferred asset class.</summary>
    public string? PreferredAssetClass { get; set; }

    /// <summary>Priority override (High / Medium / Low).</summary>
    public string Priority { get; set; } = "Medium";

    /// <summary>UTC timestamp when the deal entered its current stage.</summary>
    public DateTime? StageEnteredAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
