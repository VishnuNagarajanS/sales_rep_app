using backend.Authentication.Interfaces;
using backend.Data;
using backend.DTOs.Dashboard;
using backend.Models.Entities;
using backend.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Implementations;

public sealed class ExecutiveDashboardService(ApplicationDbContext context, ICurrentUserService currentUser) : IExecutiveDashboardService
{
    public async Task<ExecutiveDashboardDto> GetAsync(CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var today = now.Date;
        var week = today.AddDays(-7);
        var compId = currentUser.CompanyId ?? 1;
        var agentId = currentUser.UserId;

        var leads = context.Set<Lead>().AsNoTracking().Where(x => x.CompanyId == compId);
        var followups = context.Set<Followup>().AsNoTracking().Where(x => x.CompanyId == compId);
        var calls = context.Set<CallRecord>().AsNoTracking().Where(x => x.CompanyId == compId);

        if (currentUser.Role == "sales_executive" && agentId.HasValue)
        {
            leads = leads.Where(x => x.AssignedAgentId == agentId.Value);
            followups = followups.Where(x => x.AssignedAgentId == agentId.Value);
            calls = calls.Where(x => x.AgentId == agentId.Value);
        }

        var active = leads.Where(x => x.Status != "Converted" && x.Status != "Junk" && x.Status != "Not Interested");
        var todayCalls = calls.Where(x => x.Timestamp >= today);
        var hasCalls = await todayCalls.AnyAsync(cancellationToken);
        var avgTalkTime = hasCalls ? (await todayCalls.Select(x => (double?)x.Duration).AverageAsync(cancellationToken) ?? 0) : 0;

        var recentLeads = await leads
            .OrderByDescending(x => x.CreatedAt)
            .Take(5)
            .Select(x => new LeadSummaryDto { Id = x.Id, Name = x.Name, Phone = x.Phone, Status = x.Status, CreatedAt = x.CreatedAt })
            .ToListAsync(cancellationToken);

        var upcomingFollowups = await followups
            .Where(x => x.Status == "Pending" && x.ScheduledAt >= today)
            .OrderBy(x => x.ScheduledAt)
            .Take(5)
            .Select(x => new FollowupSummaryDto { Id = x.Id, LeadId = null, ScheduledAt = x.ScheduledAt, Notes = x.Notes })
            .ToListAsync(cancellationToken);

        return new ExecutiveDashboardDto
        {
            ActiveLeads = new DashboardKpiDto
            {
                Label = "Active leads",
                Value = await active.CountAsync(cancellationToken),
                WeeklyDelta = await leads.CountAsync(x => x.CreatedAt >= week, cancellationToken)
            },
            PendingFollowups = new DashboardKpiDto
            {
                Label = "Pending follow-ups",
                Value = await followups.CountAsync(x => x.Status == "Pending", cancellationToken),
                WeeklyDelta = 0
            },
            OverdueFollowups = await followups.CountAsync(x => x.Status == "Pending" && x.ScheduledAt < today, cancellationToken),
            CallsLoggedToday = await todayCalls.CountAsync(cancellationToken),
            ConnectedCallsToday = await todayCalls.CountAsync(x => x.Duration > 0 && x.Disposition != "No Answer", cancellationToken),
            AverageTalkTimeSeconds = avgTalkTime,
            RecentLeads = recentLeads,
            UpcomingFollowups = upcomingFollowups
        };
    }
}
