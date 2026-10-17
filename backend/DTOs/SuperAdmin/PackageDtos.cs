namespace backend.DTOs.SuperAdmin;

public class CreatePackageRequestDto
{
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Tier { get; set; } = "Growth";
    public decimal PriceMonthly { get; set; }
    public string Currency { get; set; } = "₹";
    public int MaxUsers { get; set; } = 25;
    public int MaxStorageGb { get; set; } = 100;
    public List<string>? Features { get; set; }
    public bool IsPopular { get; set; } = false;
    public bool IsActive { get; set; } = true;
}

public class UpdatePackageRequestDto
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Tier { get; set; } = "Growth";
    public decimal PriceMonthly { get; set; }
    public string Currency { get; set; } = "₹";
    public int MaxUsers { get; set; } = 25;
    public int MaxStorageGb { get; set; } = 100;
    public List<string>? Features { get; set; }
    public bool IsPopular { get; set; } = false;
    public bool IsActive { get; set; } = true;
}

public class PackageStatusUpdateDto
{
    public bool IsActive { get; set; }
}

public class PackageResponseDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Tier { get; set; } = "Growth";
    public decimal PriceMonthly { get; set; }
    public string Currency { get; set; } = "₹";
    public int MaxUsers { get; set; }
    public int MaxStorageGb { get; set; }
    public List<string> Features { get; set; } = new();
    public bool IsPopular { get; set; }
    public bool IsActive { get; set; }
    public int EnrolledTenantsCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
