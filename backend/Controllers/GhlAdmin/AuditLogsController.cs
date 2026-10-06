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
[Authorize(Roles = "company_admin,super_admin")]
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
        [FromQuery] string? companyId,
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
        var query = _db.AuditLogs.Include(l => l.Company).AsNoTracking().AsQueryable();

        // Super admins can see everything; company admins scoped to their tenant
        if (_currentUser.Role != "super_admin" && _currentUser.CompanyId.HasValue)
        {
            query = query.Where(l => l.CompanyId == _currentUser.CompanyId.Value);
        }
        else if (_currentUser.Role == "super_admin" && !string.IsNullOrWhiteSpace(companyId) && !companyId.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            if (companyId.Equals("global", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(l => l.CompanyId == null);
            }
            else if (int.TryParse(companyId, out var cid))
            {
                query = query.Where(l => l.CompanyId == cid);
            }
            else
            {
                var s = companyId.Trim().ToLowerInvariant();
                query = query.Where(l => l.Company != null && (l.Company.Slug.ToLower() == s || l.Company.Name.ToLower().Contains(s)));
            }
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
                l.EntityId.Contains(s) ||
                (l.Company != null && l.Company.Name.ToLower().Contains(s)));
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
                CompanyName = l.Company != null ? l.Company.Name : (l.CompanyId == null ? "PLATFORM CONSOLE" : $"Company #{l.CompanyId}"),
                Timestamp = l.Timestamp,
                ActorName = l.ActorName,
                ActorEmail = l.ActorEmail,
                Action = l.Action,
                EntityType = l.EntityType,
                EntityId = l.EntityId,
                Details = l.Details,
                IpAddress = l.IpAddress,
                UserAgent = l.UserAgent,
                Module = l.Module,
                Status = l.Status,
            })
            .ToListAsync(ct);

        // Resolve actor identities if stored as placeholder IDs (e.g. "IRM (ID: 5)") or if email/name is missing
        var userIdsToFetch = new HashSet<int>();
        var userEmailsToFetch = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var item in items)
        {
            if (string.IsNullOrWhiteSpace(item.ActorEmail) || (!string.IsNullOrWhiteSpace(item.ActorName) && item.ActorName.Contains("(ID:")))
            {
                var match = System.Text.RegularExpressions.Regex.Match(item.ActorName ?? string.Empty, @"\(ID:\s*(\d+)\)");
                if (match.Success && int.TryParse(match.Groups[1].Value, out var uid))
                {
                    userIdsToFetch.Add(uid);
                }
            }
            if (!string.IsNullOrWhiteSpace(item.ActorEmail))
            {
                userEmailsToFetch.Add(item.ActorEmail.Trim());
            }
        }

        var usersById = new Dictionary<int, (string Name, string Email)>();
        if (userIdsToFetch.Count > 0)
        {
            var userList = await _db.Users
                .Where(u => userIdsToFetch.Contains(u.Id))
                .Select(u => new { u.Id, u.Name, u.Email })
                .ToListAsync(ct);
            foreach (var u in userList)
            {
                usersById[u.Id] = (u.Name, u.Email);
            }
        }

        var usersByEmail = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (userEmailsToFetch.Count > 0)
        {
            var emailList = await _db.Users
                .Where(u => userEmailsToFetch.Contains(u.Email))
                .Select(u => new { u.Name, u.Email })
                .ToListAsync(ct);
            foreach (var u in emailList)
            {
                if (!string.IsNullOrWhiteSpace(u.Email) && !string.IsNullOrWhiteSpace(u.Name))
                {
                    usersByEmail[u.Email] = u.Name;
                }
            }
        }

        foreach (var item in items)
        {
            var match = System.Text.RegularExpressions.Regex.Match(item.ActorName ?? string.Empty, @"\(ID:\s*(\d+)\)");
            if (match.Success && int.TryParse(match.Groups[1].Value, out var uid) && usersById.TryGetValue(uid, out var uById))
            {
                item.ActorName = !string.IsNullOrWhiteSpace(uById.Name) ? uById.Name : uById.Email;
                if (string.IsNullOrWhiteSpace(item.ActorEmail))
                {
                    item.ActorEmail = uById.Email;
                }
            }
            else if (!string.IsNullOrWhiteSpace(item.ActorEmail) && (string.IsNullOrWhiteSpace(item.ActorName) || item.ActorName == item.ActorEmail))
            {
                if (usersByEmail.TryGetValue(item.ActorEmail, out var resolvedName) && !string.IsNullOrWhiteSpace(resolvedName))
                {
                    item.ActorName = resolvedName;
                }
            }
            else if (string.IsNullOrWhiteSpace(item.ActorEmail) && !string.IsNullOrWhiteSpace(item.ActorName) && item.ActorName.Contains("@"))
            {
                item.ActorEmail = item.ActorName;
            }
        }

        return Ok(ApiResponse<PagedResult<AuditLogResponseDto>>.SuccessResult(
            PagedResult<AuditLogResponseDto>.Create(items, total, page, pageSize),
            "Audit logs retrieved."));
    }
}
