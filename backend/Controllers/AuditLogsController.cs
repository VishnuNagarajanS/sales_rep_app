using backend.Authentication.Interfaces;
using backend.Data;
using backend.DTOs.AuditLogs;
using backend.DTOs.Common;
using backend.Models.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/audit-logs")]
[Authorize(Roles = "company_admin,sales_manager,super_admin,irm,admin")]
public class AuditLogsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;

    public AuditLogsController(ApplicationDbContext db, ICurrentUserService currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResult<AuditLogResponseDto>>>> GetAuditLogs(
        [FromQuery] int? companyId,
        [FromQuery] string? entityType,
        [FromQuery] string? action,
        [FromQuery] string? module,
        [FromQuery] string? search,
        [FromQuery] int? leadId,
        [FromQuery] int? customerId,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        var targetCompanyId = _currentUser.CompanyId ?? companyId;
        Console.WriteLine($"[AuditLogsController] GetAuditLogs: Role={_currentUser.Role}, CurrentCompanyId={_currentUser.CompanyId}, QueryCompanyId={companyId}, Target={targetCompanyId}");

        var query = _db.AuditLogs.AsNoTracking().AsQueryable();

        if (_currentUser.Role != "super_admin")
        {
            if (targetCompanyId.HasValue && targetCompanyId.Value > 0)
                query = query.Where(l => l.CompanyId == targetCompanyId.Value);
            else
                query = query.Where(l => false);
        }
        else if (companyId.HasValue && companyId.Value > 0)
        {
            query = query.Where(l => l.CompanyId == companyId.Value);
        }

        if (leadId.HasValue && leadId.Value > 0)
        {
            var lidStr = leadId.Value.ToString();
            query = query.Where(l => l.LeadId == leadId.Value || (l.EntityType.ToLower() == "lead" && l.EntityId == lidStr));
        }

        if (customerId.HasValue && customerId.Value > 0)
        {
            var cidStr = customerId.Value.ToString();
            query = query.Where(l => l.CustomerId == customerId.Value || (l.EntityType.ToLower() == "customer" && l.EntityId == cidStr));
        }

        if (!string.IsNullOrWhiteSpace(entityType))
            query = query.Where(l => l.EntityType == entityType);

        if (!string.IsNullOrWhiteSpace(action))
            query = query.Where(l => l.Action == action);

        if (!string.IsNullOrWhiteSpace(module))
            query = query.Where(l => l.Module == module);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(l =>
                l.ActorName.ToLower().Contains(s) ||
                l.ActorEmail.ToLower().Contains(s) ||
                l.Details.ToLower().Contains(s) ||
                l.EntityId.Contains(s));
        }

        if (from.HasValue)
            query = query.Where(l => l.Timestamp >= from.Value.ToUniversalTime());

        if (to.HasValue)
            query = query.Where(l => l.Timestamp <= to.Value.ToUniversalTime());

        var total = await query.CountAsync(ct);
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var items = await query
            .OrderByDescending(l => l.Timestamp)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(l => new AuditLogResponseDto
            {
                Id = l.Id,
                CompanyId = l.CompanyId,
                Timestamp = l.Timestamp,
                ActorName = l.ActorName,
                ActorEmail = l.ActorEmail,
                Action = l.Action,
                EntityType = l.EntityType,
                EntityId = l.EntityId,
                LeadId = l.LeadId,
                CustomerId = l.CustomerId,
                Details = l.Details,
                IpAddress = l.IpAddress,
                Module = l.Module,
                Status = l.Status,
            })
            .ToListAsync(ct);

        return Ok(ApiResponse<PagedResult<AuditLogResponseDto>>.SuccessResult(
            new PagedResult<AuditLogResponseDto>
            {
                Items = items,
                TotalCount = total,
                Page = page,
                PageSize = pageSize
            }));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<AuditLogResponseDto>>> CreateAuditLog(
        [FromBody] CreateAuditLogRequestDto request,
        CancellationToken ct = default)
    {
        var companyId = _currentUser.CompanyId;

        int? leadId = request.LeadId;
        int? customerId = request.CustomerId;

        if (!leadId.HasValue && string.Equals(request.EntityType, "Lead", StringComparison.OrdinalIgnoreCase) && int.TryParse(request.EntityId, out var parsedLid))
            leadId = parsedLid;

        if (!customerId.HasValue && string.Equals(request.EntityType, "Customer", StringComparison.OrdinalIgnoreCase) && int.TryParse(request.EntityId, out var parsedCid))
            customerId = parsedCid;

        if (leadId.HasValue && !await _db.Leads.AnyAsync(l => l.Id == leadId.Value &&
                (!companyId.HasValue || l.CompanyId == companyId.Value), ct))
            return BadRequest(ApiResponse<AuditLogResponseDto>.FailureResult("Selected lead was not found in the current company."));
        if (customerId.HasValue && !await _db.Customers.AnyAsync(c => c.Id == customerId.Value &&
                (!companyId.HasValue || c.CompanyId == companyId.Value), ct))
            return BadRequest(ApiResponse<AuditLogResponseDto>.FailureResult("Selected customer was not found in the current company."));

        var log = new AuditLog
        {
            CompanyId = companyId,
            Timestamp = DateTime.UtcNow,
            ActorName = request.ActorName,
            ActorEmail = request.ActorEmail,
            Action = request.Action,
            EntityType = request.EntityType,
            EntityId = request.EntityId,
            LeadId = leadId,
            CustomerId = customerId,
            Details = request.Details,
            Module = request.Module,
            Status = request.Status ?? "success",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString()
        };

        _db.AuditLogs.Add(log);
        await _db.SaveChangesAsync(ct);

        var dto = new AuditLogResponseDto
        {
            Id = log.Id,
            CompanyId = log.CompanyId,
            Timestamp = log.Timestamp,
            ActorName = log.ActorName,
            ActorEmail = log.ActorEmail,
            Action = log.Action,
            EntityType = log.EntityType,
            EntityId = log.EntityId,
            LeadId = log.LeadId,
            CustomerId = log.CustomerId,
            Details = log.Details,
            Module = log.Module,
            Status = log.Status,
        };

        return Ok(ApiResponse<AuditLogResponseDto>.SuccessResult(dto, "Audit log created."));
    }
}
