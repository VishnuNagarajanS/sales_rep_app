namespace backend.DTOs.SuperAdmin;

public class TicketTimelineEventDto
{
    public string Id { get; set; } = string.Empty;
    public string AuthorName { get; set; } = "Super Admin";
    public string AuthorEmail { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Type { get; set; } = "note"; // "note", "status_change", "priority_change", "system_alert", "assignment_change"
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class PlatformTicketDto
{
    public string Id { get; set; } = string.Empty;
    public string TicketNumber { get; set; } = string.Empty; // e.g. "INC-2026-1042"
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Category { get; set; } = "System Incident"; // "Telephony / Carrier Trunk", "Speech AI / Transcription", "Database / Latency", "Security & Auth", "Tenant Operational"
    public string Priority { get; set; } = "medium"; // "low", "medium", "high", "critical"
    public string Status { get; set; } = "open"; // "open", "in_progress", "escalated", "resolved", "closed"
    public int? TenantId { get; set; }
    public string? TenantName { get; set; }
    public string? TenantSlug { get; set; }
    public string ReportedByName { get; set; } = "Super Admin Telemetry";
    public string ReportedByEmail { get; set; } = "system@nexusplatform.io";
    public string? AssignedToName { get; set; } = "Super Admin Team";
    public string? AssignedToEmail { get; set; }
    public string? ResolutionNotes { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public List<TicketTimelineEventDto> Timeline { get; set; } = new();
}

public class CreatePlatformTicketRequestDto
{
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Category { get; set; } = "Telephony / Carrier Trunk";
    public string Priority { get; set; } = "high";
    public int? TenantId { get; set; }
    public string? ReportedByName { get; set; }
    public string? ReportedByEmail { get; set; }
    public string? AssignedToName { get; set; }
    public string? AssignedToEmail { get; set; }
}

public class UpdateTicketStatusRequestDto
{
    public string Status { get; set; } = "in_progress";
    public string? Note { get; set; }
    public string? ResolutionNotes { get; set; }
}

public class UpdateTicketPriorityRequestDto
{
    public string Priority { get; set; } = "medium";
    public string? Status { get; set; } // fallback if sent as status
    public string? Note { get; set; }
}

public class AssignTicketRequestDto
{
    public string AssignedToName { get; set; } = string.Empty;
    public string? AssignedToEmail { get; set; }
    public string? Note { get; set; }
}

public class AddTicketNoteRequestDto
{
    public string Message { get; set; } = string.Empty;
}

public class PlatformTicketMetricsDto
{
    public int Total { get; set; }
    public int Critical { get; set; }
    public int InProgress { get; set; }
    public int Resolved { get; set; }
    public int Open { get; set; }
    public Dictionary<string, int> StatusCounts { get; set; } = new();
    public Dictionary<string, int> PriorityCounts { get; set; } = new();
}
