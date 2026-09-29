namespace backend.Models.Entities;

public class Customer
{
    public int Id { get; set; }

    public int CompanyId { get; set; }
    public Tenant? Company { get; set; }

    public int AssignedAgentId { get; set; }
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
}
