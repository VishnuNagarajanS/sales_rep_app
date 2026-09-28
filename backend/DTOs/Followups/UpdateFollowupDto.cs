namespace backend.DTOs.Followups;

public class UpdateFollowupDto
{
    public DateTime? ScheduledAt { get; set; }
    public string? Priority { get; set; }
    public string? Status { get; set; } // "Pending" | "Completed"
    public string? Notes { get; set; }
}
