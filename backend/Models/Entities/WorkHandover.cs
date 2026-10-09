namespace backend.Models.Entities;

public class WorkHandover
{
    public int Id { get; set; }

    public int CompanyId { get; set; }
    public Tenant? Company { get; set; }

    /// <summary>
    /// Role being covered: 'sales_executive' | 'irm'
    /// </summary>
    public string RoleCode { get; set; } = "sales_executive";

    public int OriginalUserId { get; set; }
    public User? OriginalUser { get; set; }

    public int CoveringUserId { get; set; }
    public User? CoveringUser { get; set; }

    public int StartedById { get; set; }
    public User? StartedBy { get; set; }

    public string Reason { get; set; } = string.Empty;

    public DateTime StartedAt { get; set; } = DateTime.UtcNow;

    public DateTime? PlannedEndAt { get; set; }

    /// <summary>
    /// 'active' | 'ended'
    /// </summary>
    public string Status { get; set; } = "active";

    public DateTime? EndedAt { get; set; }

    public int? EndedById { get; set; }
    public User? EndedBy { get; set; }

    public string? ReturnSummaryJson { get; set; }

    /// <summary>
    /// Optional link to LeaveRequest if started via Arrange Handover shortcut.
    /// </summary>
    public int? LeaveRequestId { get; set; }
    public LeaveRequest? LeaveRequest { get; set; }

    /// <summary>
    /// Set by HandoverDueDateCheckerService when a one-time overdue notification is sent to admins.
    /// Prevents repeat notifications.
    /// </summary>
    public DateTime? OverdueNotifiedAt { get; set; }

    // Navigation
    public ICollection<WorkHandoverItem> Items { get; set; } = new List<WorkHandoverItem>();
}
