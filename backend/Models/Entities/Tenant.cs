namespace backend.Models.Entities;

public class Tenant
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string BrandColor { get; set; } = "#0284c7";
    public string? Logo { get; set; }
    public string Tagline { get; set; } = string.Empty;
    public List<string> EnabledFeatures { get; set; } = new();
    public string Timezone { get; set; } = "Asia/Kolkata (IST)";
    public string Currency { get; set; } = "₹ INR";
    public string BusinessHours { get; set; } = "09:30 AM - 07:00 PM IST";
    public bool IsActive { get; set; } = true;
    public string Status { get; set; } = "Active";
    public string? LegalName { get; set; }
    public string? Industry { get; set; }
    public string? SubscriptionPlan { get; set; }
    public int? LeadSla { get; set; }
    public bool CallEnabled { get; set; } = true;
    public bool RecordingEnabled { get; set; } = true;
    public bool TranscriptionEnabled { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    public ICollection<User> Users { get; set; } = new List<User>();
    public ICollection<TenantDidMapping> DidMappings { get; set; } = new List<TenantDidMapping>();
}
