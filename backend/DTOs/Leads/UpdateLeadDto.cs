namespace backend.DTOs.Leads;

public class UpdateLeadDto
{
    public string? Name { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Location { get; set; }
    public string? Source { get; set; }
    public string? Status { get; set; }
    public string? Priority { get; set; }
    public string? Notes { get; set; }

    public string? InvestmentCapacity { get; set; }
    public string? AssetClass { get; set; }
    public string? PreferredAssetClass { get; set; }
    public string? Horizon { get; set; }
    public string? DispositionReason { get; set; }

    public DateTime? NextFollowupDate { get; set; }

    public Dictionary<string, string>? AdditionalCustomFields { get; set; }
}
