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
        var role = (User.GetUserRole() ?? string.Empty).ToLowerInvariant();
        var currentUserId = User.GetUserId();

        // Enforce ownership: an IRM must not be able to view another IRM's call records
        int? effectiveIrmId = irmId;
        if (role == "irm")
        {
            effectiveIrmId = currentUserId;
        }

        var result = await _callService.GetAllAsync(companyId, effectiveIrmId, ct);
        return Ok(result);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var companyId = User.GetCompanyId();
        var role = (User.GetUserRole() ?? string.Empty).ToLowerInvariant();
        var currentUserId = User.GetUserId();

        var result = await _callService.GetByIdAsync(id, companyId, currentUserId, role, ct);
        if (!result.Success)
        {
            if (result.Message.StartsWith("Access denied", StringComparison.OrdinalIgnoreCase))
            {
                return StatusCode(StatusCodes.Status403Forbidden, result);
            }
            return NotFound(result);
        }

        return Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> LogCall([FromBody] LogCallDto dto, CancellationToken ct)
    {
        if (User.IsGhlAdmin())
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<CallLogDto>.ErrorResponse("Access denied: GHL Admin has read-only access to IRM call data."));
        }

        var companyId = User.GetCompanyId();
        var irmId = User.GetUserId();
        var result = await _callService.LogCallAsync(companyId, irmId, dto, ct);
        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }
}
