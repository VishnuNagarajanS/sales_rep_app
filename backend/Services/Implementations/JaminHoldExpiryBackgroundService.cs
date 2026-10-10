using backend.Data;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Implementations;

/// <summary>
/// Background timer service that periodically scans for expired plot holds
/// and releases them to 'Available' status, while marking the booking as 'Hold Expired'.
/// Runs automatically every 60 seconds.
/// </summary>
public class JaminHoldExpiryBackgroundService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<JaminHoldExpiryBackgroundService> _logger;
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(1);

    public JaminHoldExpiryBackgroundService(
        IServiceProvider serviceProvider,
        ILogger<JaminHoldExpiryBackgroundService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ExpireOverdueHoldsAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[JaminHoldExpiryBackgroundService] Error expiring overdue plot holds: {Message}", ex.Message);
            }

            try
            {
                await Task.Delay(Interval, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    private async Task ExpireOverdueHoldsAsync(CancellationToken ct)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var now = DateTime.UtcNow;
        var expiredPlots = await db.JaminPlots
            .Where(p => p.Status == "Hold" && p.HoldExpiresAt != null && p.HoldExpiresAt <= now)
            .ToListAsync(ct);

        if (!expiredPlots.Any()) return;

        var plotIds = expiredPlots.Select(p => p.Id).ToList();
        var projectIds = expiredPlots.Select(p => p.ProjectId).Distinct().ToList();

        foreach (var p in expiredPlots)
        {
            p.Status = "Available";
            p.HeldByCustomerId = null;
            p.HeldByCustomerName = null;
            p.HeldByCustomerPhone = null;
            p.HoldByAgent = null;
            p.HoldExpiresAt = null;
            p.UpdatedAt = now;
        }

        var expiredBookings = await db.JaminBookings
            .Where(b => b.PlotId != null && plotIds.Contains(b.PlotId.Value) && b.Status == "Hold")
            .ToListAsync(ct);

        foreach (var b in expiredBookings)
        {
            b.Status = "Hold Expired";
            b.UpdatedAt = now;
        }

        await db.SaveChangesAsync(ct);

        // Recalculate inventory counts for affected projects
        foreach (var projId in projectIds)
        {
            var project = await db.JaminProjects.FirstOrDefaultAsync(pr => pr.Id == projId, ct);
            if (project != null)
            {
                var plots = await db.JaminPlots.Where(p => p.ProjectId == project.Id).ToListAsync(ct);
                project.BookedPlots = plots.Count(p => p.Status is "Booked" or "Registered" or "Sold");
                project.AvailablePlots = plots.Count(p => p.Status == "Available");
                project.UpdatedAt = now;
            }
        }

        await db.SaveChangesAsync(ct);
        _logger.LogInformation("[JaminHoldExpiryBackgroundService] Successfully released {Count} expired plot holds.", expiredPlots.Count);
    }
}
