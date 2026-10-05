namespace backend.DTOs.Jamin;

public class JaminLeadDto
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public string Source { get; set; } = string.Empty;
    public string Status { get; set; } = "New";
    public string Priority { get; set; } = "Medium";
    public string Notes { get; set; } = string.Empty;
    public int? AssignedAgentId { get; set; }
    public string AssignedAgentName { get; set; } = string.Empty;
    public string? TargetDevelopment { get; set; }
    public string? PreferredVisitDate { get; set; }
    public string? PreferredTimeSlot { get; set; }
    public string? AnythingWeShouldKnow { get; set; }
    public string? BudgetRange { get; set; }
    public DateTime? NextFollowupDate { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateJaminLeadDto
{
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Location { get; set; }
    public string? Source { get; set; } = "Direct Inbound";
    public string? Priority { get; set; } = "Medium";
    public string? TargetDevelopment { get; set; }
    public string? BudgetRange { get; set; }
    public string? Notes { get; set; }
    public int? AssignedAgentId { get; set; }
}

public class UpdateJaminLeadDto
{
    public string? Name { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Location { get; set; }
    public string? Status { get; set; }
    public string? Priority { get; set; }
    public string? TargetDevelopment { get; set; }
    public string? BudgetRange { get; set; }
    public string? Notes { get; set; }
    public int? AssignedAgentId { get; set; }
}

public class AssignJaminLeadDto
{
    public int AssignedAgentId { get; set; }
    public string? Notes { get; set; }
}

public class JaminLeadDetailDto : JaminLeadDto
{
    public List<JaminSiteVisitDto> SiteVisits { get; set; } = new();
    public List<backend.DTOs.Followups.FollowupResponseDto> Followups { get; set; } = new();
}

public class JaminScheduleFollowupDto
{
    public DateTime FollowupDate { get; set; }
    public string? FollowupType { get; set; } = "call"; // call, meeting, whatsapp
    public string? Notes { get; set; }
    public int? AssignedAgentId { get; set; }
}
