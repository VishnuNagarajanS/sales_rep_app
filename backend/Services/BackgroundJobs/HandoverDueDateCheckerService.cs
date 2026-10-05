using backend.Data;
using backend.Models.Entities;
using Microsoft.EntityFrameworkCore;
using backend.Models.Enums;

namespace backend.Services.BackgroundJobs;

/// <summary>
/// Spec §4: "When PlannedEndAt passes, notify the admin.
/// Never auto-revert; the admin decides when the person is really back."
/// Checks every 15 minutes for active handovers whose planned end date has passed
/// and sends a one-time notification to the admins of that company.
/// </summary>
public class HandoverDueDateCheckerService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<HandoverDueDateCheckerService> _logger;
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(15);

    public HandoverDueDateCheckerService(
        IServiceScopeFactory scopeFactory,
        ILogger<HandoverDueDateCheckerService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("HandoverDueDateChecker started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CheckOverdueHandoversAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Error in HandoverDueDateChecker");
            }

            await Task.Delay(Interval, stoppingToken);
        }
    }

    private async Task CheckOverdueHandoversAsync(CancellationToken ct)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var now = DateTime.UtcNow;

        // Find active handovers whose planned end date has passed but have NOT yet sent an overdue notification
        // We detect "already notified" by checking if an overdue notification was already created.
        var overdueHandovers = await db.WorkHandovers
            .Include(h => h.OriginalUser)
            .Include(h => h.CoveringUser)
            .Where(h => h.Status == "active"
                     && h.PlannedEndAt.HasValue
                     && h.PlannedEndAt.Value < now
                     && !h.OverdueNotifiedAt.HasValue)
            .ToListAsync(ct);

        if (overdueHandovers.Count == 0) return;

        foreach (var handover in overdueHandovers)
        {
            // Notify all company admins
            var admins = await db.Users
                .Include(u => u.Role)
                .Where(u => u.CompanyId == handover.CompanyId
                         && (u.Role.Code == "company_admin" || u.Role.Code == "super_admin")
                         && u.Status == UserStatus.Active)
                .ToListAsync(ct);

            foreach (var admin in admins)
            {
                db.Notifications.Add(new Notification
                {
                    CompanyId = handover.CompanyId,
                    UserId = admin.Id,
                    Title = "Work Handover Overdue",
                    Message = $"The planned handover end date for {handover.OriginalUser?.Name ?? $"User #{handover.OriginalUserId}"} " +
                              $"(covered by {handover.CoveringUser?.Name ?? $"User #{handover.CoveringUserId}"}) " +
                              $"was {handover.PlannedEndAt!.Value:d MMM yyyy}. " +
                              $"Please end the handover when the team member returns. No records have been auto-reverted.",
                    Type = "warning",
                    IsRead = false,
                    CreatedAt = DateTime.UtcNow
                });
            }

            handover.OverdueNotifiedAt = now;
            _logger.LogInformation("Sent overdue handover notification for handover #{Id}", handover.Id);
        }

        await db.SaveChangesAsync(ct);
    }
}
