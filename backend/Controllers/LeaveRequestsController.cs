using System;
using System.Threading;
using System.Threading.Tasks;
using backend.DTOs.Admin;
using backend.Services.Interfaces;
using backend.Authentication.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LeaveRequestsController : ControllerBase
{
    private readonly ILeaveRequestService _leaveService;
    private readonly ICurrentUserService _currentUserService;

    public LeaveRequestsController(ILeaveRequestService leaveService, ICurrentUserService currentUserService)
    {
        _leaveService = leaveService;
        _currentUserService = currentUserService;
    }

    private int GetCompanyId()
    {
        return _currentUserService.CompanyId ?? 1;
    }

    private int GetCurrentUserId()
    {
        return _currentUserService.UserId ?? 0;
    }

    // Agent viewing their own requests
    [HttpGet("my-requests")]
    [Authorize(Roles = "sales_executive,irm,company_admin,super_admin,admin")]
    public async Task<IActionResult> GetMyRequests([FromQuery] string? status, CancellationToken ct)
    {
        var companyId = GetCompanyId();
        var userId = GetCurrentUserId();
        var result = await _leaveService.GetLeaveRequestsAsync(companyId, userId, status, null, null, null, null, null, ct);
        return Ok(result);
    }

    // Agent viewing their balance
    [HttpGet("my-balance")]
    [Authorize(Roles = "sales_executive,irm,company_admin,super_admin,admin")]
    public async Task<IActionResult> GetMyBalance(CancellationToken ct)
    {
        var companyId = GetCompanyId();
        var userId = GetCurrentUserId();
        var result = await _leaveService.GetUserLeaveBalancesAsync(companyId, userId, ct);
        return Ok(result);
    }

    // Agent creating a request
    [HttpPost("my-requests")]
    [Authorize(Roles = "sales_executive,irm,company_admin,super_admin,admin")]
    public async Task<IActionResult> CreateRequest([FromBody] CreateLeaveRequestDto dto, CancellationToken ct)
    {
        var companyId = GetCompanyId();
        var userId = GetCurrentUserId();
        var result = await _leaveService.CreateLeaveRequestAsync(companyId, userId, dto, ct);
        if (!result.Success) return BadRequest(result);
        return Ok(result);
    }

    // Agent editing a pending request
    [HttpPut("my-requests/{id}")]
    [Authorize(Roles = "sales_executive,irm,company_admin,super_admin,admin")]
    public async Task<IActionResult> UpdateRequest(int id, [FromBody] UpdateLeaveRequestDto dto, CancellationToken ct)
    {
        var companyId = GetCompanyId();
        var userId = GetCurrentUserId();
        var result = await _leaveService.UpdateLeaveRequestAsync(companyId, userId, id, dto, ct);
        if (!result.Success) return BadRequest(result);
        return Ok(result);
    }

    // Agent cancelling a request
    [HttpPost("my-requests/{id}/cancel")]
    [Authorize(Roles = "sales_executive,irm,company_admin,super_admin,admin")]
    public async Task<IActionResult> CancelRequest(int id, CancellationToken ct)
    {
        var companyId = GetCompanyId();
        var userId = GetCurrentUserId();
        var result = await _leaveService.CancelLeaveRequestAsync(companyId, userId, id, ct);
        if (!result.Success) return BadRequest(result);
        return Ok(result);
    }

    // Admin viewing all requests
    [HttpGet]
    [Authorize(Roles = "company_admin,super_admin,admin")]
    public async Task<IActionResult> GetAllRequests(
        [FromQuery] string? status,
        [FromQuery] string? type,
        [FromQuery] string? handoverState,
        [FromQuery] string? search,
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        [FromQuery] int? userId,
        CancellationToken ct)
    {
        var companyId = GetCompanyId();
        var result = await _leaveService.GetLeaveRequestsAsync(companyId, userId, status, type, handoverState, search, from, to, ct);
        return Ok(result);
    }

    // Request detail with timeline and balances
    [HttpGet("{id}")]
    [Authorize(Roles = "company_admin,super_admin,admin,sales_executive,irm")]
    public async Task<IActionResult> GetRequestDetail(int id, CancellationToken ct)
    {
        var companyId = GetCompanyId();
        var result = await _leaveService.GetLeaveRequestDetailAsync(companyId, id, ct);
        if (!result.Success) return NotFound(result);
        return Ok(result);
    }

    // Admin checking conflict warnings
    [HttpGet("{id}/conflicts")]
    [Authorize(Roles = "company_admin,super_admin,admin")]
    public async Task<IActionResult> GetConflicts(int id, CancellationToken ct)
    {
        var companyId = GetCompanyId();
        var result = await _leaveService.GetLeaveConflictsAsync(companyId, id, ct);
        if (!result.Success) return BadRequest(result);
        return Ok(result);
    }

    // Admin approving request
    [HttpPost("{id}/approve")]
    [Authorize(Roles = "company_admin,super_admin,admin")]
    public async Task<IActionResult> ApproveRequest(int id, [FromBody] ApproveLeaveRequestDto dto, CancellationToken ct)
    {
        var companyId = GetCompanyId();
        var adminId = GetCurrentUserId();
        var result = await _leaveService.ApproveLeaveRequestAsync(companyId, adminId, id, dto, ct);
        if (!result.Success) return BadRequest(result);
        return Ok(result);
    }

    // Admin rejecting request
    [HttpPost("{id}/reject")]
    [Authorize(Roles = "company_admin,super_admin,admin")]
    public async Task<IActionResult> RejectRequest(int id, [FromBody] RejectLeaveRequestDto dto, CancellationToken ct)
    {
        var companyId = GetCompanyId();
        var adminId = GetCurrentUserId();
        var result = await _leaveService.RejectLeaveRequestAsync(companyId, adminId, id, dto, ct);
        if (!result.Success) return BadRequest(result);
        return Ok(result);
    }

    // Admin marking handover not needed
    [HttpPost("{id}/handover-not-needed")]
    [Authorize(Roles = "company_admin,super_admin,admin")]
    public async Task<IActionResult> MarkHandoverNotNeeded(int id, [FromBody] HandoverNotNeededDto dto, CancellationToken ct)
    {
        var companyId = GetCompanyId();
        var adminId = GetCurrentUserId();
        var result = await _leaveService.MarkHandoverNotNeededAsync(companyId, adminId, id, dto, ct);
        if (!result.Success) return BadRequest(result);
        return Ok(result);
    }
}
