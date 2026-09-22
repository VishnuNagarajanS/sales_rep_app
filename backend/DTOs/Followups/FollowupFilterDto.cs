namespace backend.DTOs.Followups;

public class FollowupFilterDto
{
    public string? Status { get; set; } // "Pending", "Completed"
    public string? Scope { get; set; } // "all", "due", "overdue"
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 10;
}
