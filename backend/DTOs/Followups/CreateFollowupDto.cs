namespace backend.DTOs.Followups;

public class CreateFollowupDto
{
    public string ContactId { get; set; } = string.Empty;
    public string ContactType { get; set; } = "lead"; // "lead" | "customer"
    public string ContactName { get; set; } = string.Empty;
    public string ContactPhone { get; set; } = string.Empty;
    public DateTime ScheduledAt { get; set; }
    public string Priority { get; set; } = "Medium"; // Low, Medium, High, Urgent
    public string Notes { get; set; } = string.Empty;
}
