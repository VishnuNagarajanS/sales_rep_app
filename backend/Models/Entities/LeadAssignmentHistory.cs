using System;
using System.ComponentModel.DataAnnotations;

namespace backend.Models.Entities;

public class LeadAssignmentHistory
{
    [Key]
    public int Id { get; set; }
    public int LeadId { get; set; }
    public Lead? Lead { get; set; }
    
    public int? FromAgentId { get; set; }
    public User? FromAgent { get; set; }
    
    public int ToAgentId { get; set; }
    public User? ToAgent { get; set; }
    
    public int AssignedById { get; set; }
    public User? AssignedBy { get; set; }
    
    [Required]
    [MaxLength(20)]
    public string Method { get; set; } = string.Empty; // 'manual' | 'auto'
    
    public DateTime AssignedAt { get; set; }
}
