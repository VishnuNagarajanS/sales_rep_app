namespace backend.DTOs.Leads;

public class LeadResponseDto
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public int? AssignedAgentId { get; set; }
    public string? AssignedAgentName { get; set; }
    public int? AssignedIrmId { get; set; }
    public string? AssignedIrmName { get; set; }
    public string? AssignedIrmAt { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public string Source { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Priority { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;

    public Dictionary<string, string> CustomFields { get; set; } = new();

    public DateTime? NextFollowupDate { get; set; }
    public DateTime? AssignedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    public int? AssignedSalesExecutiveId { get; set; }
    public string? AssignedSalesExecutiveName { get; set; }
    public DateTime? AssignedSalesExecutiveAt { get; set; }
    public string? AssignedAgentRole { get; set; }
    public string? TransferredBySalesExecutiveName { get; set; }
    public string? ActiveOwnerName { get; set; }
    public string? ActiveOwnerRole { get; set; }
    public bool IsCovered { get; set; }
    public string? CoveredByName { get; set; }

    public int? HandoverId { get; set; }
    public string? HandedOverFromName { get; set; }
    public DateTime? HandoverPlannedEnd { get; set; }
    public int? OriginalOwnerId { get; set; }
}
