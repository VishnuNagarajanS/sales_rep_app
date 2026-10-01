namespace backend.DTOs.Jamin;

public class JaminSiteVisitDto
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public int? LeadId { get; set; }
    public int? CustomerId { get; set; }
    public int? ProjectId { get; set; }
    public int? PlotId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string? ContactType { get; set; }
    public string ProjectName { get; set; } = string.Empty;
    public string? PlotNumber { get; set; }
    public string ScheduledAt { get; set; } = string.Empty;
    public int? AssignedAgentId { get; set; }
    public string? AssignedAgentName { get; set; }
    public string Status { get; set; } = "Requested"; // Requested | Pending | Scheduled | Completed | Rescheduled | Cancelled | No-show
    public string? VisitorNote { get; set; }
    public string? OutcomeNotes { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class ScheduleSiteVisitRequestDto
{
    public int? LeadId { get; set; }
    public int? CustomerId { get; set; }
    public int? ProjectId { get; set; }
    public int? PlotId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string? ContactType { get; set; } = "lead";
    public string ProjectName { get; set; } = string.Empty;
    public string? PlotNumber { get; set; }
    public string ScheduledAt { get; set; } = string.Empty;
    public int? AssignedAgentId { get; set; }
    public string? AssignedAgentName { get; set; }
    public string? VisitorNote { get; set; }
    public string? OutcomeNotes { get; set; }
}

public class UpdateSiteVisitOutcomeDto
{
    public string? Status { get; set; } = "Completed";
    public string? OutcomeNotes { get; set; }
}
