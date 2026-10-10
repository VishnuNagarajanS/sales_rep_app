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
[Authorize(Roles = "sales_executive,company_admin,super_admin,irm")]
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
        [FromQuery] int? tenantId,
        [FromQuery] int? companyId,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        var role = _currentUser.Role;
        var agentId = _currentUser.UserId;
        var effectiveCompanyId = companyId ?? tenantId ?? _currentUser.CompanyId;

        var query = _context.CallRecords.AsNoTracking().Include(c => c.Agent).AsQueryable();

        if (role != "super_admin")
        {
            if (!effectiveCompanyId.HasValue && agentId.HasValue)
            {
                var currentUserRecord = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == agentId.Value, ct);
                effectiveCompanyId = currentUserRecord?.CompanyId;
            }

            if (effectiveCompanyId.HasValue)
            {
                query = query.Where(c => c.CompanyId == effectiveCompanyId.Value);
            }
        }
        else if (effectiveCompanyId.HasValue)
        {
            query = query.Where(c => c.CompanyId == effectiveCompanyId.Value);
        }

        // When viewing Lead 360 or Customer 360 (leadId or customerId supplied),
        // show all calls associated with that entity regardless of agent.
        // For general Call History, sales executives see only their own calls.
        if (role == "sales_executive" && agentId.HasValue && !leadId.HasValue && !customerId.HasValue)
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

        if (leadId.HasValue && customerId.HasValue)
        {
            query = query.Where(c => c.LeadId == leadId.Value || c.CustomerId == customerId.Value);
        }
        else if (leadId.HasValue)
        {
            query = query.Where(c => c.LeadId == leadId.Value);
        }
        else if (customerId.HasValue)
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
        var agent = await _context.Users.FirstOrDefaultAsync(u => u.Id == agentId, ct);
        var companyId = _currentUser.CompanyId ?? agent?.CompanyId ?? 2;

        int? customerId = dto.CustomerId;
        int? leadId = dto.LeadId;

        if (customerId.HasValue && customerId.Value <= 0) customerId = null;
        if (leadId.HasValue && leadId.Value <= 0) leadId = null;

        Customer? customer = null;
        Lead? lead = null;

        // 1. Verify and link by primary keys
        if (customerId.HasValue)
        {
            customer = await _context.Customers.FirstOrDefaultAsync(c => c.Id == customerId.Value, ct);
            if (customer != null)
            {
                customer.LastContactedAt = DateTime.UtcNow;
                companyId = customer.CompanyId;
            }
            else
            {
                customerId = null;
            }
        }

        if (leadId.HasValue)
        {
            lead = await _context.Leads.FirstOrDefaultAsync(l => l.Id == leadId.Value, ct);
            if (lead != null)
            {
                lead.UpdatedAt = DateTime.UtcNow;
                companyId = lead.CompanyId;
            }
            else
            {
                leadId = null;
            }
        }

        // 2. Cross-link if only one primary key was provided:
        // If CustomerId is set but LeadId is not, find matching converted lead
        if (customer != null && !leadId.HasValue)
        {
            var custDigits = new string(customer.Phone.Where(char.IsDigit).ToArray());
            var last10 = custDigits.Length >= 10 ? custDigits[^10..] : custDigits;
            if (!string.IsNullOrEmpty(last10))
            {
                lead = await _context.Leads.FirstOrDefaultAsync(l => l.CompanyId == customer.CompanyId && l.Phone.Contains(last10), ct);
                if (lead != null)
                {
                    leadId = lead.Id;
                }
            }
        }

        // If LeadId is set but CustomerId is not, check if this lead was converted to a Customer
        if (lead != null && !customerId.HasValue)
        {
            var leadDigits = new string(lead.Phone.Where(char.IsDigit).ToArray());
            var last10 = leadDigits.Length >= 10 ? leadDigits[^10..] : leadDigits;
            if (!string.IsNullOrEmpty(last10))
            {
                customer = await _context.Customers.FirstOrDefaultAsync(c => c.CompanyId == lead.CompanyId && c.Phone.Contains(last10), ct);
                if (customer != null)
                {
                    customerId = customer.Id;
                    customer.LastContactedAt = DateTime.UtcNow;
                }
            }
        }

        // 3. Fallback lookup by normalized phone number if neither primary key was sent
        if (!customerId.HasValue && !leadId.HasValue && !string.IsNullOrWhiteSpace(dto.ContactPhone))
        {
            var digits = new string(dto.ContactPhone.Where(char.IsDigit).ToArray());
            var last10 = digits.Length >= 10 ? digits[^10..] : digits;

            if (!string.IsNullOrEmpty(last10))
            {
                customer = await _context.Customers.FirstOrDefaultAsync(c => c.Phone.Contains(last10), ct);
                if (customer != null)
                {
                    customerId = customer.Id;
                    customer.LastContactedAt = DateTime.UtcNow;
                    companyId = customer.CompanyId;
                }

                lead = await _context.Leads.FirstOrDefaultAsync(l => l.Phone.Contains(last10), ct);
                if (lead != null)
                {
                    leadId = lead.Id;
                    lead.UpdatedAt = DateTime.UtcNow;
                    if (customer == null)
                    {
                        companyId = lead.CompanyId;
                    }
                }
            }
        }

        var contactName = dto.ContactName?.Trim();
        if (string.IsNullOrWhiteSpace(contactName) || contactName == "Contact")
        {
            contactName = customer?.Name ?? lead?.Name ?? (string.IsNullOrWhiteSpace(dto.ContactName) ? "Contact" : dto.ContactName.Trim());
        }

        var contactPhone = dto.ContactPhone?.Trim();
        if (string.IsNullOrWhiteSpace(contactPhone))
        {
            contactPhone = customer?.Phone ?? lead?.Phone ?? string.Empty;
        }

        var call = new CallRecord
        {
            CompanyId = companyId,
            AgentId = agentId,
            ContactName = contactName,
            ContactPhone = contactPhone,
            Direction = string.IsNullOrWhiteSpace(dto.Direction) ? "outbound" : dto.Direction.Trim().ToLower(),
            Duration = Math.Max(0, dto.Duration),
            Disposition = string.IsNullOrWhiteSpace(dto.Disposition) ? string.Empty : dto.Disposition.Trim(),
            Notes = dto.Notes?.Trim() ?? string.Empty,
            LeadId = leadId,
            CustomerId = customerId,
            Timestamp = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        };

        // Automatically transition Lead status based on Call Disposition
        if (lead != null && lead.Status != "Converted" && lead.Status != "Booking In Progress" && !string.IsNullOrWhiteSpace(call.Disposition))
        {
            var disp = call.Disposition.Trim();
            if (disp.Equals("Interested", StringComparison.OrdinalIgnoreCase))
                lead.Status = "Interested";
            else if (disp.Equals("Callback", StringComparison.OrdinalIgnoreCase))
                lead.Status = "Callback";
            else if (disp.Equals("Follow-up Required", StringComparison.OrdinalIgnoreCase) || disp.Equals("Followup Required", StringComparison.OrdinalIgnoreCase))
                lead.Status = "Follow-up Required";
            else if (disp.Equals("Not Interested", StringComparison.OrdinalIgnoreCase))
                lead.Status = "Not Interested";
            else if (disp.Equals("Junk", StringComparison.OrdinalIgnoreCase))
                lead.Status = "Junk";
            else if (disp.Equals("No Response", StringComparison.OrdinalIgnoreCase) || disp.Equals("No Answer", StringComparison.OrdinalIgnoreCase) || disp.Equals("Busy", StringComparison.OrdinalIgnoreCase))
                lead.Status = "No Response";
            else if (disp.Equals("Contacted", StringComparison.OrdinalIgnoreCase) || disp.Equals("Connected", StringComparison.OrdinalIgnoreCase))
            {
                if (lead.Status == "New") lead.Status = "Contacted";
            }
            lead.UpdatedAt = DateTime.UtcNow;
        }

        _context.CallRecords.Add(call);
        await _context.SaveChangesAsync(ct);

        await _context.Entry(call).Reference(c => c.Agent).LoadAsync(ct);

        // 4. Create and persist an AuditLog linked to Company and Lead / Customer
        var actorName = call.Agent?.Name ?? agent?.Name ?? _currentUser.Email ?? "Agent";
        var actorEmail = call.Agent?.Email ?? agent?.Email ?? _currentUser.Email ?? string.Empty;
        var dirUpper = (call.Direction ?? "outbound").ToUpperInvariant();
        var dirTitle = char.ToUpper((call.Direction ?? "outbound")[0]) + (call.Direction ?? "outbound")[1..].ToLowerInvariant();
        var outcomeDesc = string.IsNullOrWhiteSpace(call.Disposition) || call.Disposition == "Skipped" ? "Wrap-up Skipped" : $"Outcome: {call.Disposition}";
        var callNotesDesc = string.IsNullOrWhiteSpace(call.Notes) ? "" : $" • Notes: {call.Notes}";
        var auditDetails = $"{dirTitle} call ({call.Duration}s) with {call.ContactName} ({call.ContactPhone}) • {outcomeDesc}{callNotesDesc}";

        var auditLog = new AuditLog
        {
            CompanyId = companyId,
            Timestamp = DateTime.UtcNow,
            ActorName = actorName,
            ActorEmail = actorEmail,
            Action = $"{dirUpper}_CALL",
            EntityType = customerId.HasValue ? "Customer" : (leadId.HasValue ? "Lead" : "CallRecord"),
            EntityId = customerId.HasValue ? customerId.Value.ToString() : (leadId.HasValue ? leadId.Value.ToString() : call.Id.ToString()),
            LeadId = leadId,
            CustomerId = customerId,
            Details = auditDetails,
            Module = "CallCenter",
            Status = string.IsNullOrWhiteSpace(call.Disposition) || call.Disposition == "Skipped" ? "Skipped" : call.Disposition
        };
        _context.AuditLogs.Add(auditLog);
        await _context.SaveChangesAsync(ct);

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
