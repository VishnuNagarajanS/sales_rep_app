namespace backend.DTOs.Consultations;

public class ScheduleConsultationDto
{
    public string InvestorId { get; set; } = string.Empty;
    public string InvestorName { get; set; } = string.Empty;
    public string InvestorPhone { get; set; } = string.Empty;
    public DateTime ScheduledAt { get; set; }
    public string? Agenda { get; set; }
    public string? Notes { get; set; }
}
