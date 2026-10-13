namespace backend.DTOs.Leads;

public class ConvertLeadDto
{
    public int? ExistingCustomerId { get; set; }
    public string? DealTitle { get; set; }
    public decimal? DealValue { get; set; }
    public string? Notes { get; set; }
}
