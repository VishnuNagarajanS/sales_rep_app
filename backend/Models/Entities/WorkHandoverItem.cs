namespace backend.Models.Entities;

public class WorkHandoverItem
{
    public int Id { get; set; }

    public int HandoverId { get; set; }
    public WorkHandover? Handover { get; set; }

    /// <summary>
    /// Entity type: Lead | Customer | Followup | GhlDeal | GhlInvestor | GhlInvestmentOpportunity | Consultation | Investor | InvestorKyc | IrmPipelineCard
    /// </summary>
    public string EntityType { get; set; } = string.Empty;

    public int EntityId { get; set; }

    /// <summary>
    /// 'included_at_start' | 'created_during_coverage'
    /// </summary>
    public string Origin { get; set; } = "included_at_start";

    public DateTime? ReturnedAt { get; set; }

    /// <summary>
    /// 'returned' | 'skipped_reassigned' | null
    /// </summary>
    public string? ReturnOutcome { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
