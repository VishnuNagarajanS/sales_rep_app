namespace backend.Models.Entities;

public class Followup
{
    public int Id { get; set; }

    public int CompanyId { get; set; }
    public Tenant? Company { get; set; }

    public int AssignedAgentId { get; set; }
    public User? AssignedAgent { get; set; }

    public string ContactId { get; set; } = string.Empty;
    public string ContactType { get; set; } = "lead"; // "lead" | "customer"
    public string ContactName { get; set; } = string.Empty;
    public string ContactPhone { get; set; } = string.Empty;

    public DateTime ScheduledAt { get; set; }
    public string Priority { get; set; } = "Medium"; // Low, Medium, High, Urgent
    public string Status { get; set; } = "Pending"; // "Pending" | "Completed"
    public string Notes { get; set; } = string.Empty;

    public DateTime? CompletedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
