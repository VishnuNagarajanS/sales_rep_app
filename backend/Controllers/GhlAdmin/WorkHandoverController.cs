using System.Security.Claims;
using backend.Authentication.Interfaces;
using backend.DTOs.Common;
using backend.DTOs.WorkHandover;
using backend.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers.GhlAdmin;

[ApiController]
[Route("api/ghl/handover")]
[Authorize(Roles = "company_admin,super_admin,admin")]
public class WorkHandoverController : ControllerBase
{
    private readonly IWorkHandoverService _handoverService;
    private readonly ICurrentUserService _currentUser;

    public WorkHandoverController(IWorkHandoverService handoverService, ICurrentUserService currentUser)
    {
        _handoverService = handoverService;
        _currentUser = currentUser;
    }

    [HttpGet("candidates")]
    public async Task<IActionResult> GetCandidates([FromQuery] string role, CancellationToken ct)
    {
        var companyId = _currentUser.CompanyId ?? 1;
        if (companyId <= 0) return Unauthorized();

        try
        {
            var candidates = await _handoverService.GetCandidatesAsync(companyId, role, ct);
            return Ok(ApiResponse<List<WorkHandoverCandidateDto>>.SuccessResponse(candidates));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<List<WorkHandoverCandidateDto>>.ErrorResponse(ex.Message));
        }
    }

    [HttpPost("preview")]
    public async Task<IActionResult> GetPreview([FromBody] StartWorkHandoverRequestDto request, CancellationToken ct)
    {
        var companyId = _currentUser.CompanyId ?? 1;
        if (companyId <= 0) return Unauthorized();

        try
        {
            var preview = await _handoverService.GetPreviewAsync(companyId, request.FromUserId, request.ToUserId, ct);
            return Ok(ApiResponse<WorkHandoverPreviewDto>.SuccessResponse(preview));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<WorkHandoverPreviewDto>.ErrorResponse(ex.Message));
        }
    }

    [HttpPost("start")]
    public async Task<IActionResult> StartHandover([FromBody] StartWorkHandoverRequestDto request, CancellationToken ct)
    {
        var companyId = _currentUser.CompanyId ?? 1;
        if (companyId <= 0) return Unauthorized();

        var actorId = _currentUser.UserId ?? 1;
        var actorName = User.FindFirst(ClaimTypes.Name)?.Value ?? User.FindFirst("name")?.Value ?? "Administrator";
        var actorEmail = _currentUser.Email ?? "admin@ghl.com";

        try
        {
            var handover = await _handoverService.StartHandoverAsync(companyId, actorId, actorName, actorEmail, request, ct);
            return Ok(ApiResponse<WorkHandoverDto>.SuccessResponse(handover, "Work handover started successfully."));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<WorkHandoverDto>.ErrorResponse(ex.Message));
        }
    }

    [HttpGet("active")]
    public async Task<IActionResult> GetActiveHandovers(CancellationToken ct)
    {
        var companyId = _currentUser.CompanyId ?? 1;
        if (companyId <= 0) return Unauthorized();

        var list = await _handoverService.GetActiveHandoversAsync(companyId, ct);
        return Ok(ApiResponse<List<WorkHandoverDto>>.SuccessResponse(list));
    }

    [HttpGet("history")]
    public async Task<IActionResult> GetHandoverHistory(CancellationToken ct)
    {
        var companyId = _currentUser.CompanyId ?? 1;
        if (companyId <= 0) return Unauthorized();

        var list = await _handoverService.GetHandoverHistoryAsync(companyId, ct);
        return Ok(ApiResponse<List<WorkHandoverDto>>.SuccessResponse(list));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetHandoverById(int id, CancellationToken ct)
    {
        var companyId = _currentUser.CompanyId ?? 1;
        if (companyId <= 0) return Unauthorized();

        var handover = await _handoverService.GetHandoverByIdAsync(companyId, id, ct);
        if (handover == null)
            return NotFound(ApiResponse<WorkHandoverDto>.ErrorResponse("Handover record not found."));

        return Ok(ApiResponse<WorkHandoverDto>.SuccessResponse(handover));
    }

    [HttpPost("{id}/end")]
    public async Task<IActionResult> EndHandover(int id, CancellationToken ct)
    {
        var companyId = _currentUser.CompanyId ?? 1;
        if (companyId <= 0) return Unauthorized();

        var actorId = _currentUser.UserId ?? 1;
        var actorName = User.FindFirst(ClaimTypes.Name)?.Value ?? User.FindFirst("name")?.Value ?? "Administrator";
        var actorEmail = _currentUser.Email ?? "admin@ghl.com";

        try
        {
            var handover = await _handoverService.EndHandoverAsync(companyId, id, actorId, actorName, actorEmail, ct);
            return Ok(ApiResponse<WorkHandoverDto>.SuccessResponse(handover, "Work handover ended and records returned successfully."));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<WorkHandoverDto>.ErrorResponse(ex.Message));
        }
    }

    [HttpPost("{id}/return-items")]
    public async Task<IActionResult> ReturnSelectedItems(int id, [FromBody] ReturnSelectedItemsRequestDto request, CancellationToken ct)
    {
        var companyId = _currentUser.CompanyId ?? 1;
        if (companyId <= 0) return Unauthorized();

        var actorId = _currentUser.UserId ?? 1;
        var actorName = User.FindFirst(ClaimTypes.Name)?.Value ?? User.FindFirst("name")?.Value ?? "Administrator";
        var actorEmail = _currentUser.Email ?? "admin@ghl.com";

        try
        {
            var handover = await _handoverService.ReturnSelectedItemsAsync(companyId, id, request.ItemIds, actorId, actorName, actorEmail, ct);
            return Ok(ApiResponse<WorkHandoverDto>.SuccessResponse(handover, "Selected items returned successfully."));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<WorkHandoverDto>.ErrorResponse(ex.Message));
        }
    }
}
