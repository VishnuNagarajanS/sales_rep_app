using backend.Authentication.Interfaces;
using backend.DTOs.Common;
using backend.DTOs.WorkHandover;
using backend.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/workhandover/my-status")]
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
        var companyId = _currentUser.CompanyId;
        var userId = _currentUser.UserId;

        if (companyId == null || !userId.HasValue) return Unauthorized();

        try
        {
            var status = await _handoverService.GetMyStatusAsync(companyId.Value, userId.Value, ct);
            return Ok(ApiResponse<MyWorkHandoverStatusDto>.SuccessResponse(status));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<MyWorkHandoverStatusDto>.ErrorResponse(ex.Message));
        }
    }
}
