namespace backend.DTOs.GhlInvestors;

// ── Request DTOs ─────────────────────────────────────────────────────────────

public class CreateGhlInvestorDto
{
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string Status { get; set; } = "Lead";
    public string InvestmentCapacity { get; set; } = string.Empty;
    public string PreferredAssetClass { get; set; } = string.Empty;
    public string? ReferralSource { get; set; }
    public string? CommittedAUM { get; set; }
    public string? InvestmentMandate { get; set; }
    public string? RiskTolerance { get; set; }
    public string Notes { get; set; } = string.Empty;
}

public class UpdateGhlInvestorDto
{
    public string? Name { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Status { get; set; }
    public string? InvestmentCapacity { get; set; }
    public string? PreferredAssetClass { get; set; }
    public string? ReferralSource { get; set; }
    public string? CommittedAUM { get; set; }
    public string? InvestmentMandate { get; set; }
    public string? RiskTolerance { get; set; }
    public string? Notes { get; set; }
}

// ── Response DTOs ────────────────────────────────────────────────────────────

public class GhlInvestorResponseDto
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public int AssignedAgentId { get; set; }
    public string? AssignedAgentName { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string InvestmentCapacity { get; set; } = string.Empty;
    public string PreferredAssetClass { get; set; } = string.Empty;
    public string? ReferralSource { get; set; }
    public string? CommittedAUM { get; set; }
    public string? InvestmentMandate { get; set; }
    public string? RiskTolerance { get; set; }
    public string Notes { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
