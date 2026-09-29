namespace backend.Models.Entities;

public class InvestmentOpportunity
{
    public int Id { get; set; }

    public int CompanyId { get; set; }
    public Tenant Company { get; set; } = null!;

    // Created by IRM
    public int CreatedByIrmId { get; set; }
    public User CreatedByIrm { get; set; } = null!;

    public string Title { get; set; } = string.Empty;
    public string AssetClass { get; set; } = string.Empty;      // AIF | Commercial | Fractional | REIT | Bond
    public string Description { get; set; } = string.Empty;

    public decimal TargetIrr { get; set; }          // e.g. 18.5 (%)
    public decimal MinTicketSize { get; set; }       // e.g. 5000000 (₹50L)
    public string Tenure { get; set; } = string.Empty;         // e.g. "3 Years"
    public string RiskLevel { get; set; } = string.Empty;      // Low | Moderate | High

    public decimal TotalTargetCorpus { get; set; }
    public decimal CommittedAmount { get; set; } = 0;

    public bool IsActive { get; set; } = true;
    public DateTime? ClosingDate { get; set; }
    public string? BrochureUrl { get; set; }
    public string? FactsheetUrl { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Pitches to investors
    public ICollection<OpportunityPitch> Pitches { get; set; } = new List<OpportunityPitch>();
}
