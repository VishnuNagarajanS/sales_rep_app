namespace backend.Models.Entities;

/// <summary>
/// Tracks when an IRM pitches an InvestmentOpportunity to a specific Investor
/// and records any committed capital.
/// </summary>
public class OpportunityPitch
{
    public int Id { get; set; }

    public int OpportunityId { get; set; }
    public InvestmentOpportunity Opportunity { get; set; } = null!;

    public int InvestorId { get; set; }
    public Investor Investor { get; set; } = null!;

    // IRM who pitched
    public int PitchedByIrmId { get; set; }
    public User PitchedByIrm { get; set; } = null!;

    public DateTime PitchedAt { get; set; } = DateTime.UtcNow;
    public string? PitchNotes { get; set; }

    // Commitment tracking
    public bool IsCommitted { get; set; } = false;
    public decimal? CommittedAmount { get; set; }
    public DateTime? CommittedAt { get; set; }
    public string? CommitmentNotes { get; set; }
}
