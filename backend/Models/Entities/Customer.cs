namespace backend.Models.Entities;

public class Customer
{
    public int Id { get; set; }

    public int CompanyId { get; set; }
    public Tenant? Company { get; set; }

    public int? AssignedAgentId { get; set; }
    public User? AssignedAgent { get; set; }

    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public string Status { get; set; } = "Active"; // Active, VIP, Inactive
    public decimal TotalValue { get; set; } = 0;
    public string Notes { get; set; } = string.Empty;

    public string? CustomFieldsJson { get; set; }

    public DateTime? LastContactedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public ICollection<Followup> Followups { get; set; } = new List<Followup>();
    public ICollection<SiteVisit> SiteVisits { get; set; } = new List<SiteVisit>();
    public ICollection<JaminBooking> Bookings { get; set; } = new List<JaminBooking>();
    public ICollection<CallRecord> CallRecords { get; set; } = new List<CallRecord>();
    public ICollection<Notification> Notifications { get; set; } = new List<Notification>();
    public ICollection<AuditLog> AuditLogs { get; set; } = new List<AuditLog>();
}
