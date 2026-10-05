using backend.Authentication.Interfaces;
using backend.DTOs.Common;
using backend.DTOs.WorkHandover;
using backend.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/v1/workhandover/my-status")]
[Authorize]
public class WorkHandoverUserController : ControllerBase
{
    private readonly IWorkHandoverService _handoverService;
    private readonly ICurrentUserService _currentUser;

    public WorkHandoverUserController(IWorkHandoverService handoverService, ICurrentUserService currentUser)
    {
        _handoverService = handoverService;
        _currentUser = currentUser;
    }

    [HttpGet]
    public async Task<IActionResult> GetMyStatus(CancellationToken ct)
    {
        var companyId = _currentUser.CompanyId ?? 1;
        var userId = _currentUser.UserId;

        if (companyId <= 0 || !userId.HasValue) return Unauthorized();

        try
        {
            var status = await _handoverService.GetMyStatusAsync(companyId, userId.Value, ct);
            return Ok(ApiResponse<MyWorkHandoverStatusDto>.SuccessResponse(status));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<MyWorkHandoverStatusDto>.ErrorResponse(ex.Message));
        }
    }
}
