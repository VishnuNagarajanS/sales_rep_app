namespace backend.DTOs.Customers;

public class CreateCustomerDto
{
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Location { get; set; }
    public string? Status { get; set; } = "Active"; // Active, VIP, Inactive
    public decimal? TotalValue { get; set; } = 0;
    public string? Notes { get; set; }
    public Dictionary<string, string>? CustomFields { get; set; }
}
