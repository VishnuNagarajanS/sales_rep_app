using backend.Models.Enums;

namespace backend.DTOs.Irm;

// ── Investor DTOs ────────────────────────────────────────────────────────────

public class InvestorDto
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string InvestmentCapacity { get; set; } = string.Empty;
    public string PreferredAssetClass { get; set; } = string.Empty;
    public string? RiskTolerance { get; set; }
    public string? InvestmentMandate { get; set; }
    public string? CommittedAum { get; set; }
    public string? ReferralSource { get; set; }
    public int? AssignedIrmId { get; set; }
    public string AssignedIrmName { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class UpdateInvestorDto
{
    public string? Name { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Status { get; set; }
    public string? InvestmentCapacity { get; set; }
    public string? PreferredAssetClass { get; set; }
    public string? RiskTolerance { get; set; }
    public string? InvestmentMandate { get; set; }
    public string? CommittedAum { get; set; }
    public string? ReferralSource { get; set; }
    public string? Notes { get; set; }
}

public class InvestorActivityDto
{
    public string Type { get; set; } = string.Empty;     // call | consultation | followup | stage_change | note
    public string Description { get; set; } = string.Empty;
    public string PerformedBy { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public string? Meta { get; set; }
}

public class InvestorActivityListDto
{
    public InvestorDto Investor { get; set; } = new();
    public List<InvestorActivityDto> Activities { get; set; } = new();
}
