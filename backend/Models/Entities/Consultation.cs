namespace backend.Models.Entities;

public class Consultation
{
    public int Id { get; set; }

    public int CompanyId { get; set; }
    public Tenant? Company { get; set; }

    public int ConsultantId { get; set; }
    public User? Consultant { get; set; }

    public string InvestorId { get; set; } = string.Empty;
    public string InvestorName { get; set; } = string.Empty;
    public string InvestorPhone { get; set; } = string.Empty;

    public DateTime ScheduledAt { get; set; }
    public string Status { get; set; } = "Scheduled"; // Scheduled, Completed, Rescheduled, Cancelled, No-show
    public string Agenda { get; set; } = string.Empty;
    public string OutcomeNotes { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
