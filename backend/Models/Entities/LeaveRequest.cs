using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace backend.Models.Entities;

[Table("LeaveRequests")]
public class LeaveRequest
{
    [Key]
    public int Id { get; set; }

    public int CompanyId { get; set; }
    public Tenant? Company { get; set; }

    public int UserId { get; set; }
    public User? User { get; set; }

    [MaxLength(50)]
    public string LeaveType { get; set; } = "Casual"; // Casual | Sick | Earned | Unpaid | Other

    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }

    public bool IsHalfDay { get; set; }

    [MaxLength(20)]
    public string? HalfDaySession { get; set; } // 'first' | 'second' | null

    [Column(TypeName = "decimal(4,1)")]
    public decimal Days { get; set; } = 1.0m;
    
    [MaxLength(500)]
    public string Reason { get; set; } = string.Empty;

    // 'Pending', 'Approved', 'Rejected', 'Cancelled'
    [MaxLength(20)]
    public string Status { get; set; } = "Pending";

    // Link to Handover if approved (retained from v1)
    public int? WorkHandoverId { get; set; }
    public WorkHandover? WorkHandover { get; set; }

    public int? ApprovedById { get; set; }
    public User? ApprovedBy { get; set; }

    public int? DecidedById { get; set; }
    public User? DecidedBy { get; set; }

    public DateTime? DecisionAt { get; set; }

    [MaxLength(500)]
    public string? DecisionNote { get; set; }

    public int? CancelledById { get; set; }
    public User? CancelledBy { get; set; }

    public DateTime? CancelledAt { get; set; }

    // 'pending' | 'arranged' | 'not_needed'
    [MaxLength(30)]
    public string HandoverDecision { get; set; } = "pending";

    [MaxLength(500)]
    public string? HandoverDecisionNote { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation
    public ICollection<LeaveRequestEvent> Events { get; set; } = new List<LeaveRequestEvent>();
}
