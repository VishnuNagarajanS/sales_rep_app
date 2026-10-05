using System.Security.Claims;
using backend.Authentication.Interfaces;
using backend.DTOs.Common;
using backend.DTOs.WorkHandover;
using backend.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers.Irm;

public class ReassignIrmWorkRequestDto
{
    public int FromIrmId { get; set; }
    public int ToIrmId { get; set; }
    public string? Reason { get; set; }
}

public class EndCoverageRequestDto
{
    public int CoverageId { get; set; }
}

public class ReassignIrmWorkResultDto
{
    public int CoverageId { get; set; }
    public int ReassignedLeadsCount { get; set; }
    public int ReassignedFollowupsCount { get; set; }
    public int ReassignedKycsCount { get; set; }
    public int ReassignedDealsCount { get; set; }
    public int ReassignedInvestorsCount { get; set; }
    public string FromIrmName { get; set; } = string.Empty;
    public string ToIrmName { get; set; } = string.Empty;
    public DateTime ReassignedAt { get; set; }
}

public class IrmCoverageItemDto
{
    public int Id { get; set; }
    public int OriginalIrmId { get; set; }
    public string OriginalIrmName { get; set; } = string.Empty;
    public string OriginalIrmEmail { get; set; } = string.Empty;
    public int CoveringIrmId { get; set; }
    public string CoveringIrmName { get; set; } = string.Empty;
    public string CoveringIrmEmail { get; set; } = string.Empty;
    public string ReassignedByUserName { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public DateTime StartedAt { get; set; }
    public DateTime? EndedAt { get; set; }
    public bool IsActive { get; set; }
    public int TotalRecordsCount { get; set; }
}

[ApiController]
[Route("api/irm/admin")]
[Authorize(Roles = "company_admin,super_admin,admin")]
public class IrmReassignmentController : ControllerBase
{
    private readonly IWorkHandoverService _handoverService;
    private readonly ICurrentUserService _currentUser;

    public IrmReassignmentController(IWorkHandoverService handoverService, ICurrentUserService currentUser)
    {
        _handoverService = handoverService;
        _currentUser = currentUser;
    }

    [HttpGet("coverage/active")]
    public async Task<IActionResult> GetActiveCoverages(CancellationToken ct)
    {
        var companyId = _currentUser.CompanyId ?? 1;
        if (companyId <= 0) return Unauthorized();

        var handovers = await _handoverService.GetActiveHandoversAsync(companyId, ct);
        var dtos = handovers
            .Where(h => h.RoleCode.Equals("irm", StringComparison.OrdinalIgnoreCase))
            .Select(h => new IrmCoverageItemDto
            {
                Id = h.Id,
                OriginalIrmId = h.OriginalUserId,
                OriginalIrmName = h.OriginalUserName,
                OriginalIrmEmail = h.OriginalUserEmail,
                CoveringIrmId = h.CoveringUserId,
                CoveringIrmName = h.CoveringUserName,
                CoveringIrmEmail = h.CoveringUserEmail,
                ReassignedByUserName = h.StartedByName,
                Reason = h.Reason,
                StartedAt = h.StartedAt,
                EndedAt = h.EndedAt,
                IsActive = h.Status == "active",
                TotalRecordsCount = h.TotalItemsCount
            }).ToList();

        return Ok(ApiResponse<List<IrmCoverageItemDto>>.SuccessResponse(dtos));
    }

    [HttpPost("reassign")]
    public async Task<IActionResult> ReassignIrmWork([FromBody] ReassignIrmWorkRequestDto dto, CancellationToken ct)
    {
        if (dto.FromIrmId <= 0 || dto.ToIrmId <= 0)
            return BadRequest(ApiResponse<ReassignIrmWorkResultDto>.ErrorResponse("Valid FromIrmId and ToIrmId are required."));

        if (dto.FromIrmId == dto.ToIrmId)
            return BadRequest(ApiResponse<ReassignIrmWorkResultDto>.ErrorResponse("Cannot reassign work to the same IRM."));

        var companyId = _currentUser.CompanyId ?? 1;
        if (companyId <= 0) return Unauthorized();

        var actorId = _currentUser.UserId ?? 1;
        var actorName = User.FindFirst(ClaimTypes.Name)?.Value ?? User.FindFirst("name")?.Value ?? "Administrator";
        var actorEmail = _currentUser.Email ?? "admin@ghl.com";

        try
        {
            var handover = await _handoverService.StartHandoverAsync(
                companyId,
                actorId,
                actorName,
                actorEmail,
                new StartWorkHandoverRequestDto
                {
                    FromUserId = dto.FromIrmId,
                    ToUserId = dto.ToIrmId,
                    Reason = dto.Reason ?? "IRM Reassignment"
                },
                ct);

            var result = new ReassignIrmWorkResultDto
            {
                CoverageId = handover.Id,
                ReassignedLeadsCount = handover.Items.Count(i => i.EntityType == "Lead"),
                ReassignedFollowupsCount = handover.Items.Count(i => i.EntityType == "Followup"),
                ReassignedKycsCount = handover.Items.Count(i => i.EntityType == "InvestorKyc"),
                ReassignedDealsCount = handover.Items.Count(i => i.EntityType == "GhlDeal"),
                ReassignedInvestorsCount = handover.Items.Count(i => i.EntityType == "Investor" || i.EntityType == "GhlInvestor"),
                FromIrmName = handover.OriginalUserName,
                ToIrmName = handover.CoveringUserName,
                ReassignedAt = handover.StartedAt
            };

            return Ok(ApiResponse<ReassignIrmWorkResultDto>.SuccessResponse(result, "Work reassigned successfully."));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<ReassignIrmWorkResultDto>.ErrorResponse(ex.Message));
        }
    }

    [HttpPost("coverage/end")]
    public async Task<IActionResult> EndCoverageAssignment([FromBody] EndCoverageRequestDto dto, CancellationToken ct)
    {
        if (dto.CoverageId <= 0)
            return BadRequest(ApiResponse<bool>.ErrorResponse("Valid CoverageId is required."));

        var companyId = _currentUser.CompanyId ?? 1;
        if (companyId <= 0) return Unauthorized();

        var actorId = _currentUser.UserId ?? 1;
        var actorName = User.FindFirst(ClaimTypes.Name)?.Value ?? User.FindFirst("name")?.Value ?? "Administrator";
        var actorEmail = _currentUser.Email ?? "admin@ghl.com";

        try
        {
            await _handoverService.EndHandoverAsync(companyId, dto.CoverageId, actorId, actorName, actorEmail, ct);
            return Ok(ApiResponse<bool>.SuccessResponse(true, "Coverage ended successfully."));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<bool>.ErrorResponse(ex.Message));
        }
    }
}
