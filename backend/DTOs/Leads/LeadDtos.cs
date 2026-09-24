namespace backend.DTOs.Leads;

public sealed class LeadDto
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public int? AssignedToUserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? Location { get; set; }
    public string? Source { get; set; }
    public string? Notes { get; set; }
    public string? InvestmentCapacity { get; set; }
    public string? AssetClass { get; set; }
    public string? PreferredAssetClass { get; set; }
    public string? Horizon { get; set; }
    public string Status { get; set; } = "New";
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public sealed class UpsertLeadDto
{
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? Location { get; set; }
    public string? Source { get; set; }
    public string? Notes { get; set; }
    public string? InvestmentCapacity { get; set; }
    public string? AssetClass { get; set; }
    public string? PreferredAssetClass { get; set; }
    public string? Horizon { get; set; }
    public string Status { get; set; } = "New";
    public int? AssignedToUserId { get; set; }
}