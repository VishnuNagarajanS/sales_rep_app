using backend.DTOs.Common;
using backend.DTOs.Irm;
using backend.Extensions;
using backend.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers.Irm;

[ApiController]
[Route("api/irm/calls")]
[Authorize]
public class IrmCallsController : ControllerBase
{
    private readonly IInvestorCallService _callService;

    public IrmCallsController(IInvestorCallService callService)
    {
        _callService = callService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int? irmId, CancellationToken ct)
    {
        var companyId = User.GetCompanyId();
        var result = await _callService.GetAllAsync(companyId, irmId, ct);
        return Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> LogCall([FromBody] LogCallDto dto, CancellationToken ct)
    {
        var companyId = User.GetCompanyId();
        var irmId = User.GetUserId();
        var result = await _callService.LogCallAsync(companyId, irmId, dto, ct);
        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }
}
