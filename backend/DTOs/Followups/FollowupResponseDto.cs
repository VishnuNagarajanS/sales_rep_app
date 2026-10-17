namespace backend.DTOs.Followups;

public class FollowupResponseDto
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public int? AssignedAgentId { get; set; }
    public string? AssignedAgentName { get; set; }
    public string? AssignedRole { get; set; }
    public string ContactId { get; set; } = string.Empty;
    public string? AssignedAgentRole { get; set; }
    public int? AssignedById { get; set; }
    public string? AssignedByName { get; set; }
    public string ContactType { get; set; } = string.Empty;
    public int? LeadId { get; set; }
    public int? CustomerId { get; set; }
    public int? InvestorId { get; set; }
    public string ContactName { get; set; } = string.Empty;
    public string ContactPhone { get; set; } = string.Empty;
    public string? ContactEmail { get; set; }
    public string? Email => ContactEmail;
    public DateTime ScheduledAt { get; set; }
    public string Priority { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;
    public string? FollowupType { get; set; } = "call";
    public DateTime? CompletedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    public int? HandoverId { get; set; }
    public string? HandedOverFromName { get; set; }
    public DateTime? HandoverPlannedEnd { get; set; }
    public int? OriginalOwnerId { get; set; }

    public bool IsReturnedFromHandover { get; set; }
    public string? ReturnedFromCoveringUserName { get; set; }
    public DateTime? ReturnedAt { get; set; }
}
