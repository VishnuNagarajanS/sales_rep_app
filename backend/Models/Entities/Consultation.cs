using backend.Models.Enums;

namespace backend.Models.Entities;

public class Consultation
{
    public int Id { get; set; }

    public int CompanyId { get; set; }
    public Tenant? Company { get; set; }

    // The IRM conducting the consultation
    public int ConsultantId { get; set; }
    public User? Consultant { get; set; }
    public string ConsultantName { get; set; } = string.Empty;

    public int? HandoverId { get; set; }
    public WorkHandover? Handover { get; set; }
    public int? OriginalOwnerId { get; set; }
    public User? OriginalOwner { get; set; }

    public int? InvestorId { get; set; }
    public Investor? Investor { get; set; }

    public string InvestorName { get; set; } = string.Empty;
    public string InvestorPhone { get; set; } = string.Empty;

    public DateTime ScheduledAt { get; set; }
    public ConsultationStatus Status { get; set; } = ConsultationStatus.Scheduled;

    public string Agenda { get; set; } = string.Empty;
    public string? OutcomeNotes { get; set; }
    public string? ReferredByAgentName { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
