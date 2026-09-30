namespace backend.Models.Entities;

public class SubscriptionPackage
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Tier { get; set; } = "Growth"; // Starter, Growth, Enterprise
    public decimal PriceMonthly { get; set; }
    public string Currency { get; set; } = "₹";
    public int MaxUsers { get; set; } = 25;
    public int MaxStorageGb { get; set; } = 100;
    public List<string> Features { get; set; } = new();
    public bool IsPopular { get; set; } = false;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
