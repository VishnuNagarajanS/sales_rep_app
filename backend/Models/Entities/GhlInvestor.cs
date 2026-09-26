namespace backend.Models.Entities;

/// <summary>
/// GHL India Ventures – High-net-worth investor profile.
/// An Investor may progress from Lead → Active Investor → HNW Investor.
/// They can have linked Consultations, InvestmentOpportunities, and Followups.
/// </summary>
public class GhlInvestor
{
    public int Id { get; set; }

    public int CompanyId { get; set; }
    public Tenant? Company { get; set; }

    public int AssignedAgentId { get; set; }
    public User? AssignedAgent { get; set; }

    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;

    /// <summary>
    /// Investor lifecycle status:
    /// Lead | Active Investor | HNW Investor | Inactive
    /// </summary>
    public string Status { get; set; } = "Lead";

    /// <summary>
    /// Investment capacity range, e.g. "₹1 Cr – ₹5 Cr" or "₹25 Cr+".
    /// </summary>
    public string InvestmentCapacity { get; set; } = string.Empty;

    /// <summary>Preferred asset class: AIF | CO-AIF | Real Estate | etc.</summary>
    public string PreferredAssetClass { get; set; } = string.Empty;

    /// <summary>How the investor was referred (e.g. "Referral - HNW", "LinkedIn").</summary>
    public string? ReferralSource { get; set; }

    /// <summary>Total AUM committed to GHL funds, display string.</summary>
    public string? CommittedAUM { get; set; }

    /// <summary>Investment mandate notes (e.g. "Growth-focused, 5yr horizon").</summary>
    public string? InvestmentMandate { get; set; }

    /// <summary>Risk tolerance: Conservative | Moderate | Aggressive</summary>
    public string? RiskTolerance { get; set; }

    public string Notes { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
