using System.Text.Json.Serialization;

namespace backend.Models.Entities;

public class PlatformTicket
{
    public int Id { get; set; }
    public string TicketNumber { get; set; } = string.Empty; // e.g. "INC-2026-1001"
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Category { get; set; } = "Telephony / Carrier Trunk";
    public string Priority { get; set; } = "medium"; // low, medium, high, critical
    public string Status { get; set; } = "open"; // open, in_progress, escalated, resolved, closed
    public int? TenantId { get; set; }
    public Tenant? Tenant { get; set; }
    public string? TenantName { get; set; }
    public string? TenantSlug { get; set; }
    public string ReportedByName { get; set; } = "Super Admin";
    public string ReportedByEmail { get; set; } = "superadmin@nexusplatform.io";
    public string? AssignedToName { get; set; } = "Platform Operations";
    public string? AssignedToEmail { get; set; }
    public string? ResolutionNotes { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public List<PlatformTicketEvent> Timeline { get; set; } = new();
}

public class PlatformTicketEvent
{
    public int Id { get; set; }
    public int TicketId { get; set; }
    [JsonIgnore]
    public PlatformTicket? Ticket { get; set; }
    public string AuthorName { get; set; } = "Super Admin";
    public string AuthorEmail { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Type { get; set; } = "note"; // "note", "status_change", "priority_change", "system_alert", "assignment_change"
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
