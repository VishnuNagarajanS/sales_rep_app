using System.Security.Claims;
using backend.DTOs.Common;
using backend.DTOs.Irm;
using backend.Extensions;
using backend.Repositories.Interfaces;
using backend.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers.Irm;

[ApiController]
[Route("api/irm/pipeline")]
[Authorize]
public class IrmPipelineController : ControllerBase
{
    private readonly IIrmPipelineService _pipelineService;
    private readonly IIrmPipelineRepository _pipelineRepo;

    public IrmPipelineController(IIrmPipelineService pipelineService, IIrmPipelineRepository pipelineRepo)
    {
        _pipelineService = pipelineService;
        _pipelineRepo = pipelineRepo;
    }

    [HttpGet]
    public async Task<IActionResult> GetBoard([FromQuery] int? irmId, CancellationToken ct)
    {
        var companyId = User.GetCompanyId();
        var role = (User.FindFirstValue(ClaimTypes.Role) ?? User.FindFirstValue("role") ?? "").ToLowerInvariant();
        var isPlatformAdmin = role == "admin" || role == "ghl_admin" || role == "super_admin" || role == "company_admin";
        int? effectiveIrmId = isPlatformAdmin ? irmId : User.GetUserId();

        var result = await _pipelineService.GetBoardAsync(companyId, effectiveIrmId, ct);
        return Ok(result);
    }

    [HttpPut("{cardId:int}/move")]
    public async Task<IActionResult> MoveStage(int cardId, [FromBody] MoveIrmStageDto dto, CancellationToken ct)
    {
        if (User.IsGhlAdmin())
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<string>.ErrorResponse("Access denied: GHL Admin has read-only access to IRM pipeline data."));
        }

        var role = (User.FindFirstValue(ClaimTypes.Role) ?? User.FindFirstValue("role") ?? "").ToLowerInvariant();
        var isPlatformAdmin = role == "admin" || role == "ghl_admin" || role == "super_admin" || role == "company_admin";
        var companyId = User.GetCompanyId();
        var irmId = User.GetUserId();

        if (!isPlatformAdmin)
        {
            var card = await _pipelineRepo.GetByIdAsync(cardId, companyId, ct);
            if (card != null && card.AssignedIrmId > 0 && card.AssignedIrmId != irmId)
            {
                return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<string>.ErrorResponse("Access denied: You can only move pipeline cards assigned to you."));
            }
        }

        var result = await _pipelineService.MoveStageAsync(cardId, companyId, irmId, dto, ct);
        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpPost("{cardId:int}/activity")]
    public async Task<IActionResult> LogActivity(int cardId, [FromBody] LogIrmActivityDto dto, CancellationToken ct)
    {
        if (User.IsGhlAdmin())
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<string>.ErrorResponse("Access denied: GHL Admin has read-only access to IRM pipeline data."));
        }

        var role = (User.FindFirstValue(ClaimTypes.Role) ?? User.FindFirstValue("role") ?? "").ToLowerInvariant();
        var isPlatformAdmin = role == "admin" || role == "ghl_admin" || role == "super_admin" || role == "company_admin";
        var companyId = User.GetCompanyId();
        var irmId = User.GetUserId();

        if (!isPlatformAdmin)
        {
            var card = await _pipelineRepo.GetByIdAsync(cardId, companyId, ct);
            if (card != null && card.AssignedIrmId > 0 && card.AssignedIrmId != irmId)
            {
                return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<string>.ErrorResponse("Access denied: You can only log activity on pipeline cards assigned to you."));
            }
        }

        var result = await _pipelineService.LogActivityAsync(cardId, companyId, irmId, dto, ct);
        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }
}
