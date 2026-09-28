using backend.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/health")]
public sealed class HealthController(ApplicationDbContext context) : ControllerBase
{
    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        var connected = await context.Database.CanConnectAsync(cancellationToken);
        return connected ? Ok(new { status = "Healthy", timestamp = DateTime.UtcNow, database = "Connected" }) : StatusCode(503, new { status = "Unhealthy", timestamp = DateTime.UtcNow, database = "Disconnected" });
    }
}