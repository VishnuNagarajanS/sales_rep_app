using backend.Services.Interfaces;
using backend.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "super_admin,company_admin")]
public class ReportsController : ControllerBase
{
    private readonly IReportService _reportService;

    public ReportsController(IReportService reportService)
    {
        _reportService = reportService;
    }

    [HttpGet("export")]
    public async Task<IActionResult> ExportReport([FromQuery] string? module, CancellationToken ct)
    {
        var companyId = User.GetCompanyId();

        var fileBytes = await _reportService.GenerateExportReportAsync(companyId, module, ct);
        
        var fileName = string.IsNullOrEmpty(module) || module.Equals("All", System.StringComparison.OrdinalIgnoreCase)
            ? "Complete_Report.xlsx"
            : $"{module}_Report.xlsx";
            
        return File(fileBytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
    }
}
