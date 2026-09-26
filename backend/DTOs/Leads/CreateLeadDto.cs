namespace backend.DTOs.Leads;

public class CreateLeadDto
{
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public int? CompanyId { get; set; }
    public string? Email { get; set; }
    public string? Location { get; set; }
    public string? Source { get; set; } = "Website Inbound";
    public string? Priority { get; set; } = "Medium";
    public string? Notes { get; set; }

    // GHL Custom Fields
    public string? InvestmentCapacity { get; set; } // e.g. "₹1 Cr – ₹5 Cr"
    public string? AssetClass { get; set; } // e.g. "AIF", "CO-AIF"
    public string? PreferredAssetClass { get; set; }
    public string? Horizon { get; set; } // e.g. "3-5 Years"

    public Dictionary<string, string>? AdditionalCustomFields { get; set; }
}
