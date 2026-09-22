namespace backend.DTOs.Consultations;

public class UpdateConsultationDto
{
    public DateTime? ScheduledAt { get; set; }
    public string? Status { get; set; } // Scheduled, Completed, Rescheduled, Cancelled, No-show
    public string? Agenda { get; set; }
    public string? OutcomeNotes { get; set; }
}
