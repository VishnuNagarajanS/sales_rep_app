using backend.Authentication.Interfaces;
using backend.Data;
using backend.DTOs.Reports;
using backend.Models.Entities;
using backend.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Implementations;

public sealed class ExecutiveReportService(ApplicationDbContext context, ICurrentUserService currentUser) : IExecutiveReportService
{
    public async Task<ExecutiveReportDto> GetAsync(DateTime? from, DateTime? to, CancellationToken cancellationToken)
    {
        var calls = context.Set<CallRecord>().AsNoTracking().Where(x => x.CompanyId == currentUser.CompanyId && x.AgentId == currentUser.UserId); 
        if (from.HasValue) calls = calls.Where(x => x.Timestamp >= from.Value.ToUniversalTime()); 
        if (to.HasValue) calls = calls.Where(x => x.Timestamp <= to.Value.ToUniversalTime());
        var rows = await calls.ToListAsync(cancellationToken); 
        var total = rows.Count; 
        var followups = await context.Set<Followup>().AsNoTracking().Where(x => x.CompanyId == currentUser.CompanyId && x.AssignedAgentId == currentUser.UserId).ToListAsync(cancellationToken); 
        var completed = followups.Where(x => x.Status == "Completed"); 
        var onTime = completed.Count(x => x.CompletedAt.HasValue && x.CompletedAt <= x.ScheduledAt); 
        var overdue = followups.Count(x => x.Status == "Pending" && x.ScheduledAt < DateTime.UtcNow);
        return new ExecutiveReportDto { 
            TotalCalls = total, 
            InboundCalls = rows.Count(x => x.Direction == "inbound"), 
            OutboundCalls = rows.Count(x => x.Direction == "outbound"), 
            TotalDurationSeconds = rows.Sum(x => x.Duration), 
            AverageDurationSeconds = total == 0 ? 0 : rows.Average(x => x.Duration), 
            ConnectRatePercent = total == 0 ? 0 : rows.Count(x => x.Duration > 0 && x.Disposition != "No Answer") * 100d / total, 
            Dispositions = rows.GroupBy(x => x.Disposition).Select(x => new DispositionBreakdownDto { Disposition = x.Key, Count = x.Count(), Percentage = total == 0 ? 0 : x.Count() * 100d / total }).ToList(), 
            FollowupsCompletedOnTime = onTime, 
            FollowupsOverdue = overdue, 
            FollowupAdherencePercent = !completed.Any() ? 0 : onTime * 100d / completed.Count() 
        };
    }
}
