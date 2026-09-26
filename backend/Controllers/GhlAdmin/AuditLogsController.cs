using backend.Authentication.Interfaces;
using backend.Data;
using backend.DTOs.AuditLogs;
using backend.DTOs.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers.GhlAdmin;

/// <summary>
/// Platform-wide Audit Logs API.
/// Company Admins see their own tenant's logs.
/// Super Admins see all tenants (can filter by companyId).
/// Audit logs are read-only — they are written internally by other services.
/// </summary>
[ApiController]
[Route("api/audit-logs")]
[Authorize(Roles = "company_admin,sales_manager,super_admin")]
public class AuditLogsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;

    public AuditLogsController(ApplicationDbContext db, ICurrentUserService currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    // ── GET /api/audit-logs ───────────────────────────────────────────────────
    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResult<AuditLogResponseDto>>>> GetAuditLogs(
        [FromQuery] string? entityType,
        [FromQuery] string? action,
        [FromQuery] string? module,
        [FromQuery] string? search,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        var query = _db.AuditLogs.AsNoTracking().AsQueryable();

        // Super admins can see everything; company admins scoped to their tenant
        if (_currentUser.Role != "super_admin" && _currentUser.CompanyId.HasValue)
            query = query.Where(l => l.CompanyId == _currentUser.CompanyId.Value);

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
                Details = l.Details,
                IpAddress = l.IpAddress,
                Module = l.Module,
                Status = l.Status,
            })
            .ToListAsync(ct);

        return Ok(ApiResponse<PagedResult<AuditLogResponseDto>>.SuccessResult(
            PagedResult<AuditLogResponseDto>.Create(items, total, page, pageSize),
            "Audit logs retrieved."));
    }
}
