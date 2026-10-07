namespace backend.DTOs.Irm;

public class IrmAllLeadItemDto
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public string Source { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Priority { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;

    public int? AssignedAgentId { get; set; }
    public string? AssignedAgentName { get; set; }
    public int? AssignedById { get; set; }
    public string? AssignedByName { get; set; }
    public DateTime? AssignedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    // Calculated Current Stage
    public string CurrentStage { get; set; } = "My Leads"; // "My Leads" | "Follow-up" | "KYC" | "Opportunities" | "Converted" | "Archived"
    public string StageDetails { get; set; } = string.Empty;
    public string? KycStatus { get; set; }
    public DateTime? NextFollowupDate { get; set; }
    public decimal? DealValue { get; set; }
    public string? DealStage { get; set; }
    public string? InvestmentCapacity { get; set; }
    public string? PreferredAssetClass { get; set; }
}

public class IrmAllLeadsSummaryDto
{
    public int TotalAssignedLeads { get; set; }
    public int InMyLeads { get; set; }
    public int InFollowup { get; set; }
    public int InKyc { get; set; }
    public int InOpportunities { get; set; }
    public int Converted { get; set; }
    public List<IrmAllLeadItemDto> Leads { get; set; } = new();
}
