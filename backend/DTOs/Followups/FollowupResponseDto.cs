namespace backend.DTOs.Followups;

public class FollowupResponseDto
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public int AssignedAgentId { get; set; }
    public string? AssignedAgentName { get; set; }
    public string ContactId { get; set; } = string.Empty;
    public string? AssignedAgentRole { get; set; }
    public string ContactType { get; set; } = string.Empty;
    public string ContactName { get; set; } = string.Empty;
    public string ContactPhone { get; set; } = string.Empty;
    public string? ContactEmail { get; set; }
    public string? Email => ContactEmail;
    public DateTime ScheduledAt { get; set; }
    public string Priority { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;
    public DateTime? CompletedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    public int? HandoverId { get; set; }
    public string? HandedOverFromName { get; set; }
    public DateTime? HandoverPlannedEnd { get; set; }
    public int? OriginalOwnerId { get; set; }
}
