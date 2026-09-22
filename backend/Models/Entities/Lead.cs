namespace backend.Models.Entities;

public class Lead
{
    public int Id { get; set; }

    public int CompanyId { get; set; }
    public Tenant? Company { get; set; }

    public int AssignedAgentId { get; set; }
    public User? AssignedAgent { get; set; }

    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public string Source { get; set; } = "Website Inbound";
    public string Status { get; set; } = "New"; // New, Contacted, Callback, Interested, Follow-up Required, Not Interested, Junk, Converted
    public string Priority { get; set; } = "Medium"; // Low, Medium, High, Urgent
    public string Notes { get; set; } = string.Empty;

    // GHL Custom Fields (e.g. investmentCapacity, assetClass, preferredAssetClass, horizon, dispositionReason)
    public string? CustomFieldsJson { get; set; }

    public DateTime? NextFollowupDate { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
