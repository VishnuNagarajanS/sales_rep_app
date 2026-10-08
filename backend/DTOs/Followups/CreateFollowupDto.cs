namespace backend.DTOs.Followups;

public class CreateFollowupDto
{
    public int? CompanyId { get; set; }
    public string ContactId { get; set; } = string.Empty;
    public string ContactType { get; set; } = "lead"; // "lead" | "customer" | "investor"
    public int? LeadId { get; set; }
    public int? CustomerId { get; set; }
    public int? InvestorId { get; set; }
    public string ContactName { get; set; } = string.Empty;
    public string ContactPhone { get; set; } = string.Empty;
    public DateTime ScheduledAt { get; set; }
    public int? AssignedAgentId { get; set; }
    public string Priority { get; set; } = "Medium"; // Low, Medium, High, Urgent
    public string Notes { get; set; } = string.Empty;
    public string? FollowupType { get; set; } = "call";
}
