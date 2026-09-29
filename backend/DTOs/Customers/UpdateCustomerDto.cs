namespace backend.DTOs.Customers;

public class UpdateCustomerDto
{
    public string? Name { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Location { get; set; }
    public string? Status { get; set; }
    public decimal? TotalValue { get; set; }
    public string? Notes { get; set; }
    public Dictionary<string, string>? CustomFields { get; set; }
}
