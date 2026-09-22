namespace backend.DTOs.Consultations;

public class ConsultationResponseDto
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public int ConsultantId { get; set; }
    public string? ConsultantName { get; set; }
    public string InvestorId { get; set; } = string.Empty;
    public string InvestorName { get; set; } = string.Empty;
    public string InvestorPhone { get; set; } = string.Empty;
    public DateTime ScheduledAt { get; set; }
    public string Status { get; set; } = string.Empty;
    public string Agenda { get; set; } = string.Empty;
    public string OutcomeNotes { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
