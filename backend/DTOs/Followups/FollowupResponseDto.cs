namespace backend.DTOs.Followups;

public sealed class CreateFollowupDto
{
    public int? LeadId { get; set; }
    public DateTime ScheduledAt { get; set; }
    public string Status { get; set; } = "Pending";
    public string? Notes { get; set; }
}

public sealed class UpdateFollowupDto
{
    public int? LeadId { get; set; }
    public DateTime ScheduledAt { get; set; }
    public string Status { get; set; } = "Pending";
    public string? Notes { get; set; }
}

public sealed class FollowupResponseDto
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public int UserId { get; set; }
    public int? LeadId { get; set; }
    public DateTime ScheduledAt { get; set; }
    public string Status { get; set; } = "Pending";
    public string? Notes { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

public sealed class FollowupFilterDto
{
    public string? Status { get; set; }
    public string? Scope { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 10;
}
