using backend.DTOs.Common;
using backend.DTOs.Irm;
using backend.Extensions;
using backend.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers.Irm;

[ApiController]
[Route("api/irm/dashboard")]
[Authorize]
public class IrmDashboardController : ControllerBase
{
    private readonly IIrmDashboardService _dashboardService;

    public IrmDashboardController(IIrmDashboardService dashboardService)
    {
        _dashboardService = dashboardService;
    }

    [HttpGet("metrics")]
    public async Task<IActionResult> GetMetrics([FromQuery] int? irmId, CancellationToken ct)
    {
        var companyId = User.GetCompanyId();
        var result = await _dashboardService.GetMetricsAsync(companyId, irmId, ct);
        return Ok(result);
    }
}
