namespace backend.DTOs.SuperAdmin;

public class SubscriptionPackageDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Tier { get; set; } = "Starter";
    public decimal PriceMonthly { get; set; }
    public string Currency { get; set; } = "₹";
    public int MaxUsers { get; set; }
    public int MaxStorageGb { get; set; }
    public List<string> Features { get; set; } = new();
    public bool IsActive { get; set; }
    public bool IsPopular { get; set; }
    public int EnrolledTenantsCount { get; set; }
    public string CreatedAt { get; set; } = string.Empty;
}

public class CreatePackageDto
{
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Tier { get; set; } = "Growth";
    public decimal PriceMonthly { get; set; }
    public string Currency { get; set; } = "₹";
    public int MaxUsers { get; set; } = 30;
    public int MaxStorageGb { get; set; } = 150;
    public List<string> Features { get; set; } = new();
    public bool IsPopular { get; set; }
    public bool IsActive { get; set; } = true;
}

public class UpdatePackageDto
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? Tier { get; set; }
    public decimal? PriceMonthly { get; set; }
    public string? Currency { get; set; }
    public int? MaxUsers { get; set; }
    public int? MaxStorageGb { get; set; }
    public List<string>? Features { get; set; }
    public bool? IsPopular { get; set; }
    public bool? IsActive { get; set; }
}

public class FeatureCatalogItemDto
{
    public string Key { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}
