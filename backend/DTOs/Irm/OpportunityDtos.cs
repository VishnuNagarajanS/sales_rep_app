namespace backend.DTOs.Irm;

// ── Investment Opportunity DTOs ──────────────────────────────────────────────

public class OpportunityDto
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public int CreatedByIrmId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string AssetClass { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal TargetIrr { get; set; }
    public decimal MinTicketSize { get; set; }
    public string Tenure { get; set; } = string.Empty;
    public string RiskLevel { get; set; } = string.Empty;
    public decimal TotalTargetCorpus { get; set; }
    public decimal CommittedAmount { get; set; }
    public bool IsActive { get; set; }
    public DateTime? ClosingDate { get; set; }
    public string? BrochureUrl { get; set; }
    public string? FactsheetUrl { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class CreateOpportunityDto
{
    public string Title { get; set; } = string.Empty;
    public string AssetClass { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal TargetIrr { get; set; }
    public decimal MinTicketSize { get; set; }
    public string Tenure { get; set; } = string.Empty;
    public string RiskLevel { get; set; } = string.Empty;
    public decimal TotalTargetCorpus { get; set; }
    public DateTime? ClosingDate { get; set; }
    public string? BrochureUrl { get; set; }
}

public class PitchOpportunityDto
{
    public int InvestorId { get; set; }
    public string? PitchNotes { get; set; }
}

public class CommitOpportunityDto
{
    public int InvestorId { get; set; }
    public decimal CommittedAmount { get; set; }
    public string? CommitmentNotes { get; set; }
}

public class OpportunityPitchDto
{
    public int Id { get; set; }
    public int OpportunityId { get; set; }
    public int InvestorId { get; set; }
    public string InvestorName { get; set; } = string.Empty;
    public int PitchedByIrmId { get; set; }
    public string PitchedByIrmName { get; set; } = string.Empty;
    public DateTime PitchedAt { get; set; }
    public string? PitchNotes { get; set; }
    public bool IsCommitted { get; set; }
    public decimal? CommittedAmount { get; set; }
    public DateTime? CommittedAt { get; set; }
    public string? CommitmentNotes { get; set; }
}
