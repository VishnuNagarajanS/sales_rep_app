using backend.Models.Enums;

namespace backend.Models.Entities;

public class Investor
{
    public int Id { get; set; }

    public int CompanyId { get; set; }
    public Tenant Company { get; set; } = null!;

    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;

    public InvestorStatus Status { get; set; } = InvestorStatus.Lead;

    public string InvestmentCapacity { get; set; } = string.Empty;   // e.g. "₹5 Cr – ₹10 Cr"
    public string PreferredAssetClass { get; set; } = string.Empty;  // e.g. "AIF"
    public string? RiskTolerance { get; set; }                       // Conservative | Moderate | Aggressive
    public string? InvestmentMandate { get; set; }
    public string? CommittedAum { get; set; }
    public string? ReferralSource { get; set; }

    // IRM assignment
    public int? AssignedIrmId { get; set; }
    public User? AssignedIrm { get; set; }
    public string AssignedIrmName { get; set; } = string.Empty;

    public string Notes { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation
    public ICollection<Consultation> Consultations { get; set; } = new List<Consultation>();
    public ICollection<InvestorKyc> KycRecords { get; set; } = new List<InvestorKyc>();
    public ICollection<Followup> Followups { get; set; } = new List<Followup>();
    public ICollection<InvestorCall> Calls { get; set; } = new List<InvestorCall>();
}
