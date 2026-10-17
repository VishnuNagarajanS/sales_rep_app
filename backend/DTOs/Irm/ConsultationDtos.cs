namespace backend.DTOs.Irm;

// ── Consultation DTOs ────────────────────────────────────────────────────────

public class ConsultationDto
{
    public int Id { get; set; }
    public int InvestorId { get; set; }
    public int CompanyId { get; set; }
    public int ConsultantId { get; set; }
    public string ConsultantName { get; set; } = string.Empty;
    public string InvestorName { get; set; } = string.Empty;
    public string InvestorPhone { get; set; } = string.Empty;
    public DateTime ScheduledAt { get; set; }
    public string Status { get; set; } = string.Empty;
    public string Agenda { get; set; } = string.Empty;
    public string? OutcomeNotes { get; set; }
    public string? ReferredByAgentName { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    public int? HandoverId { get; set; }
    public string? HandedOverFromName { get; set; }
    public DateTime? HandoverPlannedEnd { get; set; }
    public int? OriginalOwnerId { get; set; }
}

public class CreateConsultationDto
{
    public int InvestorId { get; set; }
    public string InvestorName { get; set; } = string.Empty;
    public string InvestorPhone { get; set; } = string.Empty;
    public DateTime ScheduledAt { get; set; }
    public string Agenda { get; set; } = string.Empty;
    public string? ReferredByAgentName { get; set; }
}

public class UpdateConsultationDto
{
    public DateTime? ScheduledAt { get; set; }
    public string? Status { get; set; }
    public string? Agenda { get; set; }
}

public class ConsultationOutcomeDto
{
    public string OutcomeNotes { get; set; } = string.Empty;
    /// <summary>Completed | NoShow</summary>
    public string Status { get; set; } = "Completed";
}
