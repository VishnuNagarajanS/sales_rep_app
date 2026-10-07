namespace backend.DTOs.SuperAdmin;

public class CreateTenantRequestDto
{
    public string Name { get; set; } = string.Empty;
    public string? LegalName { get; set; }
    public string? Slug { get; set; }
    public string? BrandColor { get; set; }
    public string? Logo { get; set; }
    public string? Tagline { get; set; }
    public string? Industry { get; set; }
    public List<string>? EnabledFeatures { get; set; }
    public string? Timezone { get; set; }
    public string? Currency { get; set; }
    public string? BusinessHours { get; set; }
    public string? Status { get; set; } // Active, Inactive, Suspended
    public string? SubscriptionPlan { get; set; }
    public int? LeadSla { get; set; }
    public bool? CallEnabled { get; set; }
    public bool? RecordingEnabled { get; set; }
    public bool? TranscriptionEnabled { get; set; }

    // Optional admin user to provision with this tenant
    public TenantAdminUserDto? AdminUser { get; set; }

    // Optional DID hotline to allocate with this tenant
    public TenantDidProvisionDto? DidData { get; set; }
    public TenantDidProvisionDto? Did { get => DidData; set => DidData = value; }
}

public class TenantAdminUserDto
{
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Password { get; set; }
}

public class TenantDidProvisionDto
{
    public string? PhoneNumber { get; set; }
    public string? RoutingStrategy { get; set; }
}

public class UpdateTenantRequestDto
{
    public string Name { get; set; } = string.Empty;
    public string? LegalName { get; set; }
    public string? Slug { get; set; }
    public string? BrandColor { get; set; }
    public string? Logo { get; set; }
    public string? Tagline { get; set; }
    public string? Industry { get; set; }
    public List<string>? EnabledFeatures { get; set; }
    public string? Timezone { get; set; }
    public string? Currency { get; set; }
    public string? BusinessHours { get; set; }
    public string? Status { get; set; }
    public string? SubscriptionPlan { get; set; }
    public int? LeadSla { get; set; }
    public bool? CallEnabled { get; set; }
    public bool? RecordingEnabled { get; set; }
    public bool? TranscriptionEnabled { get; set; }
}

public class TenantStatusUpdateDto
{
    public string Status { get; set; } = "Active"; // Active, Inactive, Suspended
}

public class TenantResponseDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string BrandColor { get; set; } = "#0284c7";
    public string? Logo { get; set; }
    public string Tagline { get; set; } = string.Empty;
    public List<string> EnabledFeatures { get; set; } = new();
    public string Timezone { get; set; } = "Asia/Kolkata (IST)";
    public string Currency { get; set; } = "₹ INR";
    public string BusinessHours { get; set; } = "09:30 AM - 07:00 PM IST";
    public string Status { get; set; } = "Active";
    public string? LegalName { get; set; }
    public string? Industry { get; set; }
    public string? SubscriptionPlan { get; set; }
    public int? LeadSla { get; set; }
    public bool CallEnabled { get; set; } = true;
    public bool RecordingEnabled { get; set; } = true;
    public bool TranscriptionEnabled { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public int UsersCount { get; set; }
    public int ActiveUsersCount { get; set; }
    public int LeadsCount { get; set; }
    public int CustomersCount { get; set; }
    public int CallsCount { get; set; }
    public int DidsCount { get; set; }
    public string? StorageUsage { get; set; } = "1.2 GB / 50 GB";
    public bool IsProtected { get; set; }
}
