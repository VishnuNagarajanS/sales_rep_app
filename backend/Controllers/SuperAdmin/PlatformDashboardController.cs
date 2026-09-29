using backend.DTOs.Common;
using backend.DTOs.SuperAdmin;
using backend.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers.SuperAdmin;

[ApiController]
[Authorize(Roles = "super_admin")]
[Route("api/super-admin/dashboard")]
[Route("api/platform/dashboard")]
public class PlatformDashboardController : ControllerBase
{
    private readonly IPlatformDashboardService _dashboardService;

    public PlatformDashboardController(IPlatformDashboardService dashboardService)
    {
        _dashboardService = dashboardService;
    }

    [HttpGet("metrics")]
    public async Task<ActionResult<ApiResponse<PlatformMetricsDto>>> GetPlatformMetrics(CancellationToken ct = default)
    {
        var result = await _dashboardService.GetPlatformMetricsAsync(ct);
        return Ok(result);
    }

    [HttpGet("fleet-summary")]
    public async Task<ActionResult<ApiResponse<List<FleetCompanyStatDto>>>> GetFleetCompanyStats(CancellationToken ct = default)
    {
        var result = await _dashboardService.GetFleetCompanyStatsAsync(ct);
        return Ok(result);
    }
}
