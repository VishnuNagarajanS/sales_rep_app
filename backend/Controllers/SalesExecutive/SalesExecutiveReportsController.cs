using backend.DTOs.Common;
using backend.DTOs.Reports;
using backend.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers.SalesExecutive;

[ApiController, Authorize(Roles = "sales_executive,company_admin,sales_manager,super_admin,irm"), Route("api/sales-executive/reports")]
public sealed class SalesExecutiveReportsController(IExecutiveReportService service) : ControllerBase
{
    [HttpGet] public async Task<IActionResult> Get([FromQuery] DateTime? from = null, [FromQuery] DateTime? to = null, CancellationToken cancellationToken = default) => Ok(ApiResponse<ExecutiveReportDto>.SuccessResult(await service.GetAsync(from, to, cancellationToken)));
}
