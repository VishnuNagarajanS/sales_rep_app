using backend.DTOs.Common;
using backend.DTOs.Irm;
using backend.Extensions;
using backend.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers.Irm;

[ApiController]
[Route("api/irm/followups")]
[Authorize]
public class IrmFollowupsController : ControllerBase
{
    private readonly IIrmFollowupService _followupService;

    public IrmFollowupsController(IIrmFollowupService followupService)
    {
        _followupService = followupService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int? assignedToId, [FromQuery] string? status, CancellationToken ct)
    {
        var companyId = User.GetCompanyId();
        var result = await _followupService.GetAllAsync(companyId, assignedToId, status, ct);
        return Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateFollowupDto dto, CancellationToken ct)
    {
        var companyId = User.GetCompanyId();
        var assignedToId = User.GetUserId();
        var role = User.GetUserRole();
        var result = await _followupService.CreateAsync(companyId, assignedToId, role, dto, ct);
        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpPut("{id:int}/complete")]
    public async Task<IActionResult> Complete(int id, [FromBody] CompleteFollowupDto dto, CancellationToken ct)
    {
        var companyId = User.GetCompanyId();
        var result = await _followupService.CompleteAsync(id, companyId, dto, ct);
        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpPut("{id:int}/reschedule")]
    public async Task<IActionResult> Reschedule(int id, [FromBody] RescheduleFollowupDto dto, CancellationToken ct)
    {
        var companyId = User.GetCompanyId();
        var result = await _followupService.RescheduleAsync(id, companyId, dto, ct);
        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }
}
