using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using backend.Data;
using backend.Models.Entities;
using backend.Models.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace backend.Services.BackgroundJobs;

/// <summary>
/// Spec §4.5: Runs every 15 minutes and on startup to send informational reminders to admins.
/// Reminders never modify any data.
/// </summary>
public class LeaveReminderBackgroundService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<LeaveReminderBackgroundService> _logger;
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(15);

    public LeaveReminderBackgroundService(
        IServiceScopeFactory scopeFactory,
        ILogger<LeaveReminderBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("LeaveReminderBackgroundService started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessRemindersAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Error processing leave reminders");
            }

            await Task.Delay(Interval, stoppingToken);
        }
    }

    private async Task ProcessRemindersAsync(CancellationToken ct)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var nowUtc = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(nowUtc);
        var tomorrow = today.AddDays(1);

        // Fetch all active companies
        var companyIds = await db.Tenants.Where(t => t.IsActive).Select(t => t.Id).ToListAsync(ct);

        foreach (var companyId in companyIds)
        {
            var admins = await db.Users
                .Include(u => u.Role)
                .Where(u => u.CompanyId == companyId &&
                            u.Role != null &&
                            (u.Role.Code == "company_admin" || u.Role.Code == "super_admin") &&
                            u.Status == UserStatus.Active)
                .ToListAsync(ct);

            if (admins.Count == 0) continue;

            // 1. Approved leave starting within 1 day (today or tomorrow) with state not_arranged
            var approvedStartingSoon = await db.LeaveRequests
                .Include(lr => lr.User)
                .Where(lr => lr.CompanyId == companyId &&
                            lr.Status == "Approved" &&
                            lr.StartDate <= tomorrow &&
                            lr.StartDate >= today &&
                            lr.HandoverDecision == "pending")
                .ToListAsync(ct);

            var activeHandovers = await db.WorkHandovers
                .Where(wh => wh.CompanyId == companyId && wh.Status == "active")
                .ToListAsync(ct);

            foreach (var leave in approvedStartingSoon)
            {
                var isCovered = activeHandovers.Any(wh => wh.OriginalUserId == leave.UserId && (wh.LeaveRequestId == leave.Id || (DateOnly.FromDateTime(wh.StartedAt) <= leave.EndDate && leave.StartDate <= (wh.PlannedEndAt.HasValue ? DateOnly.FromDateTime(wh.PlannedEndAt.Value) : DateOnly.MaxValue))));
                if (isCovered) continue;

                var reminderTitle = $"Leave Starts Soon - Handover Needed (Req #{leave.Id})";
                var alreadyNotified = await db.Notifications.AnyAsync(n => n.CompanyId == companyId && n.Title == reminderTitle, ct);

                if (!alreadyNotified)
                {
                    foreach (var admin in admins)
                    {
                        db.Notifications.Add(new Notification
                        {
                            CompanyId = companyId,
                            UserId = admin.Id,
                            Title = reminderTitle,
                            Message = $"{leave.User?.Name ?? "Employee"}'s leave starts {(leave.StartDate == today ? "today" : "tomorrow")} and no handover is arranged. You can arrange one in Work Handover.",
                            Type = "warning",
                            IsRead = false,
                            CreatedAt = nowUtc
                        });
                    }
                }
            }

            // 2. Leave ending today or tomorrow with an active handover
            var endingSoonLeaves = await db.LeaveRequests
                .Include(lr => lr.User)
                .Where(lr => lr.CompanyId == companyId &&
                            lr.Status == "Approved" &&
                            lr.EndDate <= tomorrow &&
                            lr.EndDate >= today)
                .ToListAsync(ct);

            foreach (var leave in endingSoonLeaves)
            {
                var activeHandover = activeHandovers.FirstOrDefault(wh => wh.OriginalUserId == leave.UserId && (wh.LeaveRequestId == leave.Id || (DateOnly.FromDateTime(wh.StartedAt) <= leave.EndDate && leave.StartDate <= (wh.PlannedEndAt.HasValue ? DateOnly.FromDateTime(wh.PlannedEndAt.Value) : DateOnly.MaxValue))));
                if (activeHandover == null) continue;

                var reminderTitle = $"Handover Return Due (Req #{leave.Id})";
                var alreadyNotified = await db.Notifications.AnyAsync(n => n.CompanyId == companyId && n.Title == reminderTitle, ct);

                if (!alreadyNotified)
                {
                    foreach (var admin in admins)
                    {
                        db.Notifications.Add(new Notification
                        {
                            CompanyId = companyId,
                            UserId = admin.Id,
                            Title = reminderTitle,
                            Message = $"{leave.User?.Name ?? "Employee"} returns on {leave.EndDate:d MMM}. Handover #{activeHandover.Id} is still active. End it from Work Handover when they return.",
                            Type = "info",
                            IsRead = false,
                            CreatedAt = nowUtc
                        });
                    }
                }
            }

            // 3. Pending requests older than 48 hours (waiting for decision, sent once per 24 hours)
            var stalePendingLeaves = await db.LeaveRequests
                .Include(lr => lr.User)
                .Where(lr => lr.CompanyId == companyId &&
                            lr.Status == "Pending" &&
                            lr.CreatedAt <= nowUtc.AddHours(-48))
                .ToListAsync(ct);

            var oneDayAgo = nowUtc.AddHours(-24);

            foreach (var leave in stalePendingLeaves)
            {
                var reminderTitle = $"Leave Request Pending Decision (Req #{leave.Id})";
                var sentInLast24h = await db.Notifications.AnyAsync(n => n.CompanyId == companyId && n.Title == reminderTitle && n.CreatedAt >= oneDayAgo, ct);

                if (!sentInLast24h)
                {
                    foreach (var admin in admins)
                    {
                        db.Notifications.Add(new Notification
                        {
                            CompanyId = companyId,
                            UserId = admin.Id,
                            Title = reminderTitle,
                            Message = $"{leave.User?.Name ?? "Employee"}'s leave request submitted on {leave.CreatedAt:d MMM} is waiting for your decision.",
                            Type = "warning",
                            IsRead = false,
                            CreatedAt = nowUtc
                        });
                    }
                }
            }
        }

        await db.SaveChangesAsync(ct);
    }
}
