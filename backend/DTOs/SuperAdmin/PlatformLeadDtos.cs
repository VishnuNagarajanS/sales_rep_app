namespace backend.DTOs.SuperAdmin;

public class PlatformLeadDto
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public string TenantName { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string Status { get; set; } = string.Empty;
    public string Priority { get; set; } = string.Empty;
    public string? AssignedAgentName { get; set; }
    public string? Source { get; set; }
    public string? Location { get; set; }
    public string? CreatedAt { get; set; }
}

public class TenantLeadCountDto
{
    public int TenantId { get; set; }
    public string TenantName { get; set; } = string.Empty;
    public int Count { get; set; }
}

public class PlatformLeadSummaryDto
{
    public int Total { get; set; }
    public int NewLeads { get; set; }
    public int InterestedLeads { get; set; }
    public int ConvertedLeads { get; set; }
    public int NotInterestedLeads { get; set; }
    public int ThisMonthLeads { get; set; }
    public int LastMonthLeads { get; set; }
    public List<TenantLeadCountDto> ByTenant { get; set; } = new();
}

public class PlatformLeadsResponseDto
{
    public List<PlatformLeadDto> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages { get; set; }
    public PlatformLeadSummaryDto Summary { get; set; } = new();
}
