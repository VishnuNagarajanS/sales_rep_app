namespace backend.DTOs.Leads;

public class LeadResponseDto
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public int AssignedAgentId { get; set; }
    public string? AssignedAgentName { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public string Source { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Priority { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;

    public Dictionary<string, string> CustomFields { get; set; } = new();

    public DateTime? NextFollowupDate { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
