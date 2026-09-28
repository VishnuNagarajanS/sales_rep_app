namespace backend.Models.Entities;

public class Customer
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public int? AssignedToUserId { get; set; }
    public User? AssignedToUser { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? Location { get; set; }
    public string Status { get; set; } = "Active"; // Active, VIP, Inactive
    public string KycStatus { get; set; } = "Pending"; // Pending, Submitted, UnderReview, Verified, Rejected
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public ICollection<CustomerKyc> KycRecords { get; set; } = new List<CustomerKyc>();
    public ICollection<KycDocument> Documents { get; set; } = new List<KycDocument>();
}
