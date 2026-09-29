namespace backend.DTOs.SuperAdmin;

public class PlatformTenantDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? LegalName { get; set; }
    public string? Industry { get; set; }
    public string BrandColor { get; set; } = "#0284c7";
    public string? Logo { get; set; }
    public string Tagline { get; set; } = string.Empty;
    public List<string> EnabledFeatures { get; set; } = new();
    public string Timezone { get; set; } = "Asia/Kolkata (IST)";
    public string Currency { get; set; } = "₹ INR";
    public string BusinessHours { get; set; } = "09:30 AM - 07:00 PM IST";
    public string Status { get; set; } = "Active"; // Active | Inactive | Suspended
    public string? SubscriptionPlan { get; set; }
    public int LeadSla { get; set; } = 15;
    public bool CallEnabled { get; set; } = true;
    public bool RecordingEnabled { get; set; } = true;
    public bool TranscriptionEnabled { get; set; } = true;
    public int UsersCount { get; set; }
    public int ActiveUsersCount { get; set; }
    public int DidsCount { get; set; }
    public string CreatedAt { get; set; } = string.Empty;
    public string? UpdatedAt { get; set; }
}

public class PlatformTenantDetailDto : PlatformTenantDto
{
    public List<PlatformUserDto> Users { get; set; } = new();
    public List<TenantDidMappingDto> Dids { get; set; } = new();
}

public class CreateTenantWizardDto
{
    // Step 1: Profile
    public string Name { get; set; } = string.Empty;
    public string? LegalName { get; set; }
    public string? Slug { get; set; }
    public string? Industry { get; set; }
    public string? Tagline { get; set; }
    public string? BrandColor { get; set; }
    public string? Timezone { get; set; }
    public string? Currency { get; set; }
    public string? BusinessHours { get; set; }

    // Step 2: Plan & Features
    public string? SubscriptionPlan { get; set; }
    public List<string> EnabledFeatures { get; set; } = new();

    // Step 3: Primary Company Admin
    public string? AdminName { get; set; }
    public string? AdminEmail { get; set; }
    public string? AdminPhone { get; set; }
    public string? AdminPassword { get; set; }

    // Step 4: Telephony DID
    public string? DidPhoneNumber { get; set; }
    public string? DidRoutingStrategy { get; set; }
    public string? DidQueueName { get; set; }
}

public class UpdateTenantDto
{
    public string? Name { get; set; }
    public string? LegalName { get; set; }
    public string? Industry { get; set; }
    public string? BrandColor { get; set; }
    public string? Logo { get; set; }
    public string? Tagline { get; set; }
    public string? Timezone { get; set; }
    public string? Currency { get; set; }
    public string? BusinessHours { get; set; }
    public string? SubscriptionPlan { get; set; }
    public int? LeadSla { get; set; }
    public bool? CallEnabled { get; set; }
    public bool? RecordingEnabled { get; set; }
    public bool? TranscriptionEnabled { get; set; }
    public string? Status { get; set; }
}

public class UpdateTenantFeaturesDto
{
    public List<string> EnabledFeatures { get; set; } = new();
}

public class UpdateTenantStatusDto
{
    public string Status { get; set; } = "Active"; // Active | Inactive | Suspended
}
