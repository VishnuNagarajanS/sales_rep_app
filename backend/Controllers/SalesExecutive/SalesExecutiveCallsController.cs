using backend.Authentication.Interfaces;
using backend.Data;
using backend.DTOs.Calls;
using backend.DTOs.Common;
using backend.Models.Entities;
using backend.Services.Interfaces;
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
    private readonly ICallService _callService;

    public SalesExecutiveCallsController(
        ApplicationDbContext context, 
        ICurrentUserService currentUser,
        ICallService callService)
    {
        _context = context;
        _currentUser = currentUser;
        _callService = callService;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResult<CallRecordResponseDto>>>> GetCalls(
        [FromQuery] string? search,
        [FromQuery] string? direction,
        [FromQuery] string? disposition,
        [FromQuery] int? leadId,
        [FromQuery] int? customerId,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
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
            query = query.Where(c => c.ContactName.ToLower().Contains(s) || c.ContactPhone.Contains(s) || (c.Notes != null && c.Notes.ToLower().Contains(s)));
        }

        if (!string.IsNullOrWhiteSpace(direction))
        {
            var d = direction.Trim().ToLower();
            query = query.Where(c => c.Direction == d);
        }

        if (!string.IsNullOrWhiteSpace(disposition))
        {
            query = query.Where(c => c.Disposition == disposition);
        }

        if (leadId.HasValue)
        {
            query = query.Where(c => c.LeadId == leadId.Value);
        }

        if (customerId.HasValue)
        {
            query = query.Where(c => c.CustomerId == customerId.Value);
        }

        if (from.HasValue)
        {
            query = query.Where(c => c.Timestamp >= from.Value.ToUniversalTime());
        }

        if (to.HasValue)
        {
            query = query.Where(c => c.Timestamp <= to.Value.ToUniversalTime());
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
        if (!await _context.Users.AnyAsync(u => u.Id == agentId && u.CompanyId == companyId, ct))
            return BadRequest(ApiResponse<CallRecordResponseDto>.FailureResult("The current agent does not belong to this company."));

        int? customerId = dto.CustomerId;
        int? leadId = dto.LeadId;

        if (customerId.HasValue && leadId.HasValue)
            return BadRequest(ApiResponse<CallRecordResponseDto>.FailureResult("A call can be linked to either a lead or a customer, not both."));

        // Verify and link CustomerId or LeadId
        if (customerId.HasValue)
        {
            var customer = await _context.Customers.FirstOrDefaultAsync(c => c.Id == customerId.Value && c.CompanyId == companyId, ct);
            if (customer == null)
                return BadRequest(ApiResponse<CallRecordResponseDto>.FailureResult("Selected customer was not found in this company."));
            customer.LastContactedAt = DateTime.UtcNow;
        }
        else if (leadId.HasValue)
        {
            var lead = await _context.Leads.FirstOrDefaultAsync(l => l.Id == leadId.Value && l.CompanyId == companyId, ct);
            if (lead == null)
                return BadRequest(ApiResponse<CallRecordResponseDto>.FailureResult("Selected lead was not found in this company."));
            lead.UpdatedAt = DateTime.UtcNow;
        }
        else if (!string.IsNullOrWhiteSpace(dto.ContactPhone))
        {
            var phone = dto.ContactPhone.Trim();
            var customer = await _context.Customers.FirstOrDefaultAsync(c => c.CompanyId == companyId && c.Phone == phone, ct);
            if (customer != null)
            {
                customerId = customer.Id;
                customer.LastContactedAt = DateTime.UtcNow;
            }
            else
            {
                var lead = await _context.Leads.FirstOrDefaultAsync(l => l.CompanyId == companyId && l.Phone == phone, ct);
                if (lead != null)
                {
                    leadId = lead.Id;
                    lead.UpdatedAt = DateTime.UtcNow;
                }
            }
        }

        var call = new CallRecord
        {
            CompanyId = companyId,
            AgentId = agentId,
            ContactName = dto.ContactName.Trim(),
            ContactPhone = dto.ContactPhone.Trim(),
            Direction = string.IsNullOrWhiteSpace(dto.Direction) ? "outbound" : dto.Direction.Trim().ToLower(),
            Duration = dto.Duration,
            Disposition = dto.Disposition.Trim(),
            Notes = dto.Notes?.Trim() ?? string.Empty,
            LeadId = leadId,
            CustomerId = customerId,
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

    [HttpPost("disposition")]
    public async Task<ActionResult<ApiResponse<CallRecordDto>>> ProcessDisposition(
        [FromBody] CallDispositionDto request,
        CancellationToken ct = default)
    {
        var result = await _callService.ProcessDispositionAsync(request, ct);
        return Ok(result);
    }
}
