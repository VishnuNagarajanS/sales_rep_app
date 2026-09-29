namespace backend.Models.Entities;

/// <summary>
/// Platform-wide audit log.
/// Records every create / update / delete action by any user on any entity.
/// Scoped by CompanyId so each tenant sees only their own audit trail.
/// Super Admins can see all tenants.
/// </summary>
public class AuditLog
{
    public int Id { get; set; }

    /// <summary>Tenant this log entry belongs to. Null for platform-level actions.</summary>
    public int? CompanyId { get; set; }
    public Tenant? Company { get; set; }

    /// <summary>UTC timestamp when the action occurred.</summary>
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    /// <summary>Display name of the user who performed the action.</summary>
    public string ActorName { get; set; } = string.Empty;

    /// <summary>Email of the actor (for cross-reference with Users table).</summary>
    public string ActorEmail { get; set; } = string.Empty;

    /// <summary>
    /// Action verb: CREATE | UPDATE | DELETE | LOGIN | LOGOUT | EXPORT | IMPORT | CONVERT | ASSIGN
    /// </summary>
    public string Action { get; set; } = string.Empty;

    /// <summary>
    /// Entity type affected: Lead | Customer | Deal | Followup | CallRecord |
    /// Investor | Opportunity | Consultation | User | Tenant | etc.
    /// </summary>
    public string EntityType { get; set; } = string.Empty;

    /// <summary>String representation of the affected entity's primary key.</summary>
    public string EntityId { get; set; } = string.Empty;

    /// <summary>Human-readable description of what changed.</summary>
    public string Details { get; set; } = string.Empty;

    /// <summary>Originating IP address of the request.</summary>
    public string? IpAddress { get; set; }

    /// <summary>Browser user-agent string.</summary>
    public string? UserAgent { get; set; }

    /// <summary>
    /// Module / page that triggered the action
    /// (e.g. "Leads", "Pipeline", "Investors", "CallCenter").
    /// </summary>
    public string? Module { get; set; }

    /// <summary>Whether the action completed successfully.</summary>
    public string Status { get; set; } = "success"; // success | failure
}
