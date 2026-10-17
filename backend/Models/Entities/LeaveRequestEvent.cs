using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace backend.Models.Entities;

[Table("LeaveRequestEvents")]
public class LeaveRequestEvent
{
    [Key]
    public int Id { get; set; }

    public int LeaveRequestId { get; set; }
    public LeaveRequest? LeaveRequest { get; set; }

    [MaxLength(50)]
    public string Action { get; set; } = string.Empty; // 'submitted'|'approved'|'rejected'|'cancelled'|'edited'|'handover_linked'|'handover_not_needed'

    public int ActorId { get; set; }
    public User? Actor { get; set; }

    [MaxLength(500)]
    public string? Note { get; set; }

    public DateTime At { get; set; } = DateTime.UtcNow;
}
