using System.Diagnostics;
using backend.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class HealthController(ApplicationDbContext context) : ControllerBase
{
    [HttpGet]
    [HttpGet("/health")]
    [AllowAnonymous]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        var sw = Stopwatch.StartNew();
        var connected = await context.Database.CanConnectAsync(cancellationToken);
        sw.Stop();

        return connected
            ? Ok(new
            {
                status = "Healthy",
                service = "sales_rep_backend",
                timestamp = DateTime.UtcNow,
                database = "Connected",
                latencyMs = sw.ElapsedMilliseconds
            })
            : StatusCode(503, new
            {
                status = "Unhealthy",
                service = "sales_rep_backend",
                timestamp = DateTime.UtcNow,
                database = "Disconnected",
                latencyMs = sw.ElapsedMilliseconds
            });
    }

    [HttpGet("live")]
    [HttpGet("/health/live")]
    [AllowAnonymous]
    public IActionResult Live()
    {
        return Ok(new
        {
            status = "Live",
            service = "sales_rep_backend",
            timestamp = DateTime.UtcNow,
            uptime = (DateTime.UtcNow - Process.GetCurrentProcess().StartTime.ToUniversalTime()).ToString(@"dd\.hh\:mm\:ss")
        });
    }

    [HttpGet("ready")]
    [HttpGet("/health/ready")]
    [AllowAnonymous]
    public async Task<IActionResult> Ready(CancellationToken cancellationToken)
    {
        var sw = Stopwatch.StartNew();
        var canConnect = await context.Database.CanConnectAsync(cancellationToken);
        sw.Stop();

        if (!canConnect)
        {
            return StatusCode(503, new
            {
                status = "Unhealthy",
                reason = "Database connectivity check failed",
                timestamp = DateTime.UtcNow,
                databaseLatencyMs = sw.ElapsedMilliseconds
            });
        }

        return Ok(new
        {
            status = "Ready",
            service = "sales_rep_backend",
            timestamp = DateTime.UtcNow,
            database = "Connected",
            databaseLatencyMs = sw.ElapsedMilliseconds,
            allocatedMemoryBytes = GC.GetTotalMemory(false)
        });
    }
}