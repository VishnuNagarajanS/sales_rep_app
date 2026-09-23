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
        var today = DateTime.UtcNow.Date; var week = today.AddDays(-7);
        var leads = context.Set<Lead>().AsNoTracking().Where(x => x.CompanyId == currentUser.CompanyId && x.AssignedAgentId == currentUser.UserId);
        var followups = context.Set<Followup>().AsNoTracking().Where(x => x.CompanyId == currentUser.CompanyId && x.AssignedAgentId == currentUser.UserId);
        var calls = context.Set<CallRecord>().AsNoTracking().Where(x => x.CompanyId == currentUser.CompanyId && x.AgentId == currentUser.UserId);
        var active = leads.Where(x => x.Status != "Converted" && x.Status != "Junk");
        var todayCalls = calls.Where(x => x.Timestamp >= today);
        return new ExecutiveDashboardDto {
            ActiveLeads = new DashboardKpiDto { Label = "Active leads", Value = await active.CountAsync(cancellationToken), WeeklyDelta = await leads.CountAsync(x => x.CreatedAt >= week, cancellationToken) },
            PendingFollowups = new DashboardKpiDto { Label = "Pending follow-ups", Value = await followups.CountAsync(x => x.Status == "Pending", cancellationToken), WeeklyDelta = 0 },
            OverdueFollowups = await followups.CountAsync(x => x.Status == "Pending" && x.ScheduledAt < today, cancellationToken),
            CallsLoggedToday = await todayCalls.CountAsync(cancellationToken),
            ConnectedCallsToday = await todayCalls.CountAsync(x => x.Duration > 0 && x.Disposition != "No Answer", cancellationToken),
            AverageTalkTimeSeconds = await todayCalls.Select(x => (double?)x.Duration).AverageAsync(cancellationToken) ?? 0,
            RecentLeads = await leads.OrderByDescending(x => x.CreatedAt).Take(5).Select(x => new LeadSummaryDto { Id = x.Id, Name = x.Name, Phone = x.Phone, Status = x.Status, CreatedAt = x.CreatedAt }).ToListAsync(cancellationToken),
            UpcomingFollowups = await followups.Where(x => x.Status == "Pending" && x.ScheduledAt >= today).OrderBy(x => x.ScheduledAt).Take(5).Select(x => new FollowupSummaryDto { Id = x.Id, LeadId = x.LeadId, ScheduledAt = x.ScheduledAt, Notes = x.Notes }).ToListAsync(cancellationToken)
        };
    }
}
