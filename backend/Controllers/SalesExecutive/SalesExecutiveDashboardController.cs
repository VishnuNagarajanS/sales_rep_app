using backend.DTOs.Common;
using backend.DTOs.Dashboard;
using backend.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers.SalesExecutive;

[ApiController, Authorize(Roles = "sales_executive,company_admin,sales_manager,super_admin,irm"), Route("api/sales-executive/dashboard")]
public sealed class SalesExecutiveDashboardController(IExecutiveDashboardService service) : ControllerBase
{
    [HttpGet] public async Task<IActionResult> Get(CancellationToken cancellationToken) => Ok(ApiResponse<ExecutiveDashboardDto>.SuccessResult(await service.GetAsync(cancellationToken)));
}
