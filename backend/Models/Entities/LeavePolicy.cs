using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace backend.Models.Entities;

[Table("LeavePolicies")]
public class LeavePolicy
{
    [Key]
    public int Id { get; set; }

    public int CompanyId { get; set; }
    public Tenant? Company { get; set; }

    [MaxLength(50)]
    public string LeaveType { get; set; } = string.Empty; // Casual, Sick, Earned, Unpaid, Other

    [Column(TypeName = "decimal(4,1)")]
    public decimal AnnualQuotaDays { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
