using backend.Authentication.Interfaces;
using backend.Data;
using backend.DTOs.Calls;
using backend.DTOs.Common;
using backend.Models.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers.SalesExecutive;

[ApiController]
[Route("api/sales-executive/calls")]
[Authorize(Roles = "sales_executive,company_admin,sales_manager,super_admin,irm")]
public class SalesExecutiveCallsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public SalesExecutiveCallsController(ApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResult<CallRecordResponseDto>>>> GetCalls(
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var role = _currentUser.Role;
        var agentId = _currentUser.UserId;
        var companyId = _currentUser.CompanyId;

        var query = _context.CallRecords.AsNoTracking().Include(c => c.Agent).AsQueryable();

        if (role != "super_admin" && companyId.HasValue)
        {
            query = query.Where(c => c.CompanyId == companyId.Value);
        }

        if (role == "sales_executive" && agentId.HasValue)
        {
            query = query.Where(c => c.AgentId == agentId.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(c => c.ContactName.ToLower().Contains(s) || c.ContactPhone.Contains(s) || c.Notes.ToLower().Contains(s));
        }

        var totalCount = await query.CountAsync(ct);

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var items = await query
            .OrderByDescending(c => c.Timestamp)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new CallRecordResponseDto
            {
                Id = c.Id,
                CompanyId = c.CompanyId,
                AgentId = c.AgentId,
                AgentName = c.Agent != null ? c.Agent.Name : null,
                ContactName = c.ContactName,
                ContactPhone = c.ContactPhone,
                Direction = c.Direction,
                Duration = c.Duration,
                Disposition = c.Disposition,
                Notes = c.Notes,
                LeadId = c.LeadId,
                CustomerId = c.CustomerId,
                Timestamp = c.Timestamp,
                CreatedAt = c.CreatedAt
            })
            .ToListAsync(ct);

        return Ok(ApiResponse<PagedResult<CallRecordResponseDto>>.SuccessResult(
            PagedResult<CallRecordResponseDto>.Create(items, totalCount, page, pageSize),
            "Call records retrieved successfully."));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<CallRecordResponseDto>>> LogCall(
        [FromBody] LogCallDto dto,
        CancellationToken ct = default)
    {
        var agentId = _currentUser.UserId ?? 1;
        var companyId = _currentUser.CompanyId ?? 1;

        var call = new CallRecord
        {
            CompanyId = companyId,
            AgentId = agentId,
            ContactName = dto.ContactName.Trim(),
            ContactPhone = dto.ContactPhone.Trim(),
            Direction = string.IsNullOrWhiteSpace(dto.Direction) ? "outbound" : dto.Direction.Trim().ToLower(),
            Duration = dto.Duration,
            Disposition = dto.Disposition.Trim(),
            Notes = dto.Notes.Trim(),
            LeadId = dto.LeadId,
            CustomerId = dto.CustomerId,
            Timestamp = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        };

        _context.CallRecords.Add(call);
        await _context.SaveChangesAsync(ct);

        await _context.Entry(call).Reference(c => c.Agent).LoadAsync(ct);

        var response = new CallRecordResponseDto
        {
            Id = call.Id,
            CompanyId = call.CompanyId,
            AgentId = call.AgentId,
            AgentName = call.Agent?.Name,
            ContactName = call.ContactName,
            ContactPhone = call.ContactPhone,
            Direction = call.Direction,
            Duration = call.Duration,
            Disposition = call.Disposition,
            Notes = call.Notes,
            LeadId = call.LeadId,
            CustomerId = call.CustomerId,
            Timestamp = call.Timestamp,
            CreatedAt = call.CreatedAt
        };

        return Ok(ApiResponse<CallRecordResponseDto>.SuccessResult(response, "Call record logged successfully."));
    }
}
