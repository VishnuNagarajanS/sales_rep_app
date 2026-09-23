using backend.DTOs.Calls;

namespace backend.DTOs.Dashboard;

public class ExecutiveDashboardDto
{
    public DashboardKpiDto ActiveLeads { get; init; } = new();
    public DashboardKpiDto PendingFollowups { get; init; } = new();
    public int OverdueFollowups { get; init; }
    public int CallsLoggedToday { get; init; }
    public int ConnectedCallsToday { get; init; }
    public double AverageTalkTimeSeconds { get; init; }
    public IReadOnlyList<LeadSummaryDto> RecentLeads { get; init; } = Array.Empty<LeadSummaryDto>();
    public IReadOnlyList<FollowupSummaryDto> UpcomingFollowups { get; init; } = Array.Empty<FollowupSummaryDto>();
}

public class LeadSummaryDto
{
    public int Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Phone { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public DateTime CreatedAt { get; init; }
}

public class FollowupSummaryDto
{
    public int Id { get; init; }
    public int? LeadId { get; init; }
    public DateTime ScheduledAt { get; init; }
    public string? Notes { get; init; }
}
