using backend.Extensions;
using backend.DTOs.Common;
using backend.DTOs.Dashboard;
using backend.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers.SalesExecutive;

[ApiController, Authorize(Roles = "sales_executive,company_admin,super_admin,irm"), Route("api/sales-executive/dashboard")]
public sealed class SalesExecutiveDashboardController(IExecutiveDashboardService service) : ControllerBase
{
    [HttpGet] public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        var compId = User.GetCompanyId(0);
        if (compId <= 0) return Unauthorized();
        return Ok(ApiResponse<ExecutiveDashboardDto>.SuccessResult(await service.GetAsync(cancellationToken)));
    }
}
