namespace backend.DTOs.GhlOpportunities;

// ── Request DTOs ─────────────────────────────────────────────────────────────

public class CreateGhlOpportunityDto
{
    public string Title { get; set; } = string.Empty;
    public int InvestorId { get; set; }
    public string InvestorName { get; set; } = string.Empty;
    public string Stage { get; set; } = "Enquiry";
    public decimal TargetAmount { get; set; } = 0;
    public decimal CommittedAmount { get; set; } = 0;
    public string ExpectedCloseDate { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;
}

public class UpdateGhlOpportunityDto
{
    public string? Title { get; set; }
    public string? Stage { get; set; }
    public decimal? TargetAmount { get; set; }
    public decimal? CommittedAmount { get; set; }
    public string? ExpectedCloseDate { get; set; }
    public string? Notes { get; set; }
}

// ── Response DTOs ────────────────────────────────────────────────────────────

public class GhlOpportunityResponseDto
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public int InvestorId { get; set; }
    public string InvestorName { get; set; } = string.Empty;
    public int AssignedAgentId { get; set; }
    public string? AssignedAgentName { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Stage { get; set; } = string.Empty;
    public decimal TargetAmount { get; set; }
    public decimal CommittedAmount { get; set; }
    public string ExpectedCloseDate { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
