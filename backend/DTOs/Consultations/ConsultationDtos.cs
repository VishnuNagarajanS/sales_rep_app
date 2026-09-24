namespace backend.DTOs.Consultations;

public sealed class ScheduleConsultationDto
{
    public string InvestorId { get; set; } = string.Empty;
    public string InvestorName { get; set; } = string.Empty;
    public string InvestorPhone { get; set; } = string.Empty;
    public string ConsultantId { get; set; } = string.Empty;
    public string ConsultantName { get; set; } = string.Empty;
    public string ScheduledAt { get; set; } = string.Empty;
    public string Status { get; set; } = "Scheduled";
    public string Agenda { get; set; } = string.Empty;
    public string? OutcomeNotes { get; set; }
}

public sealed class UpdateConsultationDto
{
    public string InvestorId { get; set; } = string.Empty;
    public string InvestorName { get; set; } = string.Empty;
    public string InvestorPhone { get; set; } = string.Empty;
    public string ConsultantId { get; set; } = string.Empty;
    public string ConsultantName { get; set; } = string.Empty;
    public string ScheduledAt { get; set; } = string.Empty;
    public string Status { get; set; } = "Scheduled";
    public string Agenda { get; set; } = string.Empty;
    public string? OutcomeNotes { get; set; }
}

public sealed class ConsultationResponseDto
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string InvestorId { get; set; } = string.Empty;
    public string InvestorName { get; set; } = string.Empty;
    public string InvestorPhone { get; set; } = string.Empty;
    public string ConsultantId { get; set; } = string.Empty;
    public string ConsultantName { get; set; } = string.Empty;
    public string ScheduledAt { get; set; } = string.Empty;
    public string Status { get; set; } = "Scheduled";
    public string Agenda { get; set; } = string.Empty;
    public string? OutcomeNotes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
