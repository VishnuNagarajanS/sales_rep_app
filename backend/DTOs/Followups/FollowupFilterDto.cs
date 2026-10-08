namespace backend.DTOs.Followups;

public class FollowupFilterDto
{
    public string? Status { get; set; } // "Pending", "Completed", "all"
    public string? Scope { get; set; } // "all", "due", "overdue"
    public int? CompanyId { get; set; }
    public int? AgentId { get; set; }
    public string? ContactId { get; set; }
    public string? ContactType { get; set; }
    public int? LeadId { get; set; }
    public int? CustomerId { get; set; }
    public string? Search { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 100;
}
