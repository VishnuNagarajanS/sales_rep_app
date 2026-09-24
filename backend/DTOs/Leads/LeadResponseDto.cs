namespace backend.DTOs.Leads;

public sealed class CreateLeadDto
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

public sealed class UpdateLeadDto
{
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? Location { get; set; }
    public string Status { get; set; } = "New";
    public int? AssignedToUserId { get; set; }
    public string? Source { get; set; }
    public string? Notes { get; set; }
    public string? InvestmentCapacity { get; set; }
    public string? AssetClass { get; set; }
    public string? PreferredAssetClass { get; set; }
    public string? Horizon { get; set; }
}

public sealed class LeadResponseDto
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

public sealed class LeadFilterDto
{
    public string? Status { get; set; }
    public string? Search { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 10;
}

public sealed class ConvertLeadDto
{
    public string? CustomerName { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Notes { get; set; }
}
