namespace backend.DTOs.Followups;

public class UpdateFollowupDto
{
    public DateTime? ScheduledAt { get; set; }
    public string? Priority { get; set; }
    public string? Status { get; set; } // "Pending" | "Completed" | "Rescheduled" | "Cancelled"
    public string? Notes { get; set; }
    public int? AssignedAgentId { get; set; }
    public string? FollowupType { get; set; }
    public int? LeadId { get; set; }
    public int? CustomerId { get; set; }
    public int? InvestorId { get; set; }
}
