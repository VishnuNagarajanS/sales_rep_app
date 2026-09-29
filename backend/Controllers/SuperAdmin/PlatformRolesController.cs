using backend.Authentication.Interfaces;
using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.SuperAdmin;
using backend.Models.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers.SuperAdmin;

[ApiController]
[Authorize(Roles = "super_admin")]
[Route("api/super-admin/roles")]
[Route("api/platform/roles")]
public class PlatformRolesController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;

    public PlatformRolesController(ApplicationDbContext db, ICurrentUserService currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<PlatformRoleDto>>>> GetAllRoles(CancellationToken ct = default)
    {
        var roles = await _db.Roles.AsNoTracking().OrderBy(r => r.Id).ToListAsync(ct);
        var result = roles.Select(r => new PlatformRoleDto
        {
            Id = r.Id.ToString(),
            Name = r.Name,
            Code = r.Code,
            Permissions = r.Permissions ?? new List<string>()
        }).ToList();

        return Ok(ApiResponse<List<PlatformRoleDto>>.SuccessResult(result));
    }

    [HttpGet("permission-groups")]
    public ActionResult<ApiResponse<List<object>>> GetPermissionGroups()
    {
        var groups = new List<object>
        {
            new { group = "Inbound Leads Management", items = new[] {
                new { key = "leads.view", label = "View Leads", description = "Browse and inspect inbound and converted lead profiles" },
                new { key = "leads.create", label = "Create Lead", description = "Manually register prospective contact records" },
                new { key = "leads.update", label = "Update Lead", description = "Modify contact information, intent tags, and custom fields" },
                new { key = "leads.delete", label = "Delete Lead", description = "Permanently remove or archive lead records" },
                new { key = "leads.assign", label = "Assign Lead", description = "Re-route or delegate leads to individual sales reps" },
                new { key = "leads.convert", label = "Convert Lead", description = "Execute conversion workflow from Lead to Customer 360" },
                new { key = "leads.export", label = "Export Leads CSV", description = "Download CSV dumps of company lead tables" },
                new { key = "leads.import", label = "Import Leads CSV", description = "Batch ingest contacts with custom column mapping" }
            }},
            new { group = "Customer 360 & Commercial Deals", items = new[] {
                new { key = "customers.view", label = "View Customers", description = "Access Customer 360 profiles and unified interaction timelines" },
                new { key = "customers.create", label = "Create Customer", description = "Manually register confirmed institutional/buyer accounts" },
                new { key = "customers.update", label = "Update Customer", description = "Modify contact details, VIP badges, and custom notes" },
                new { key = "customers.delete", label = "Delete Customer", description = "Deactivate or purge customer records" },
                new { key = "deals.view", label = "View Deals & Pipeline", description = "Access Kanban pipeline stages and financial revenue values" },
                new { key = "deals.create", label = "Create Deal", description = "Add new commercial deal to active pipeline" },
                new { key = "deals.update", label = "Update Deal & Stage", description = "Move deals across stages and adjust close probability" },
                new { key = "deals.delete", label = "Delete Deal", description = "Purge deal records from company pipeline" }
            }},
            new { group = "Telephony & Live Softphone Calling", items = new[] {
                new { key = "calls.make", label = "Initiate Click-to-Call", description = "Trigger outgoing WebRTC/SIP calls via embedded softphone" },
                new { key = "calls.receive", label = "Receive Inbound Calls", description = "Accept inbound incoming calls routed to queue" },
                new { key = "calls.view", label = "View Call Logs", description = "Inspect call center history, durations, and dispositions" },
                new { key = "calls.recordings.play", label = "Playback Call Audio", description = "Stream voice recordings and review speech transcripts" }
            }},
            new { group = "Follow-ups & Task Reminders", items = new[] {
                new { key = "followups.view", label = "View Tasks & Follow-ups", description = "Inspect scheduled callback agenda and overdue reminders" },
                new { key = "followups.create", label = "Schedule Follow-up", description = "Book upcoming callbacks, meetings, or WhatsApp tasks" },
                new { key = "followups.update", label = "Complete / Reschedule", description = "Mark follow-up completed or reschedule slot" }
            }},
            new { group = "Company Administration & Governance", items = new[] {
                new { key = "users.view", label = "View User Directory", description = "Inspect staff directory, roles, and status" },
                new { key = "users.manage", label = "Manage Team Members", description = "Invite, edit, or revoke credentials of team members" },
                new { key = "roles.view", label = "View Roles & Permissions", description = "Inspect assigned role matrix" },
                new { key = "settings.view", label = "View Organization Settings", description = "Inspect company configuration" },
                new { key = "settings.update", label = "Update Organization Settings", description = "Modify branding and telephony parameters" },
                new { key = "audit.view", label = "View Security Audit Log", description = "Inspect compliance event timeline" }
            }}
        };

        return Ok(ApiResponse<List<object>>.SuccessResult(groups));
    }

    [HttpGet("{idOrCode}")]
    public async Task<ActionResult<ApiResponse<PlatformRoleDto>>> GetRole(string idOrCode, CancellationToken ct = default)
    {
        Role? role = null;
        if (int.TryParse(idOrCode, out var id))
        {
            role = await _db.Roles.AsNoTracking().FirstOrDefaultAsync(r => r.Id == id, ct);
        }
        else
        {
            role = await _db.Roles.AsNoTracking().FirstOrDefaultAsync(r => r.Code == idOrCode.Trim().ToLowerInvariant(), ct);
        }

        if (role == null)
            return NotFound(ApiResponse<PlatformRoleDto>.FailureResult($"Role '{idOrCode}' not found."));

        var dto = new PlatformRoleDto
        {
            Id = role.Id.ToString(),
            Name = role.Name,
            Code = role.Code,
            Permissions = role.Permissions ?? new List<string>()
        };

        return Ok(ApiResponse<PlatformRoleDto>.SuccessResult(dto));
    }

    [HttpPut("{idOrCode}/permissions")]
    public async Task<ActionResult<ApiResponse<PlatformRoleDto>>> UpdateRolePermissions(
        string idOrCode,
        [FromBody] UpdateRolePermissionsDto dto,
        CancellationToken ct = default)
    {
        Role? role = null;
        if (int.TryParse(idOrCode, out var id))
        {
            role = await _db.Roles.FirstOrDefaultAsync(r => r.Id == id, ct);
        }
        else
        {
            role = await _db.Roles.FirstOrDefaultAsync(r => r.Code == idOrCode.Trim().ToLowerInvariant(), ct);
        }

        if (role == null)
            return NotFound(ApiResponse<PlatformRoleDto>.FailureResult($"Role '{idOrCode}' not found."));

        role.Permissions = dto.Permissions ?? new List<string>();

        _db.AuditLogs.Add(new AuditLog
        {
            CompanyId = null,
            Timestamp = DateTime.UtcNow,
            ActorName = "Super Admin",
            ActorEmail = _currentUser.Email ?? "yanosh@ghlindiaventures.com",
            Action = "UPDATE_ROLE_PERMISSIONS",
            EntityType = "Role",
            EntityId = role.Code,
            Details = $"Super Admin updated permission matrix for role '{role.Name}' ({role.Code}). Total permissions: {role.Permissions.Count}.",
            Module = "Roles",
            Status = "success"
        });

        await _db.SaveChangesAsync(ct);

        var resultDto = new PlatformRoleDto
        {
            Id = role.Id.ToString(),
            Name = role.Name,
            Code = role.Code,
            Permissions = role.Permissions
        };

        return Ok(ApiResponse<PlatformRoleDto>.SuccessResult(resultDto, $"Permissions updated for role '{role.Name}'."));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<PlatformRoleDto>>> CreateCustomRole(
        [FromBody] CreateCustomRoleDto dto,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(dto.Name) || string.IsNullOrWhiteSpace(dto.Code))
            return BadRequest(ApiResponse<PlatformRoleDto>.FailureResult("Role Name and Code are required."));

        var normalizedCode = dto.Code.Trim().ToLowerInvariant().Replace(" ", "_");
        var existing = await _db.Roles.AnyAsync(r => r.Code == normalizedCode, ct);
        if (existing)
            return BadRequest(ApiResponse<PlatformRoleDto>.FailureResult($"Role with code '{normalizedCode}' already exists."));

        var permissions = dto.Permissions ?? new List<string>();
        if (permissions.Count == 0 && !string.IsNullOrWhiteSpace(dto.BaseTemplateRole))
        {
            var template = await _db.Roles.AsNoTracking().FirstOrDefaultAsync(r => r.Code == dto.BaseTemplateRole, ct);
            if (template != null && template.Permissions != null)
            {
                permissions = new List<string>(template.Permissions);
            }
        }

        var newRole = new Role
        {
            Name = dto.Name.Trim(),
            Code = normalizedCode,
            Permissions = permissions,
            CreatedAt = DateTime.UtcNow
        };

        _db.Roles.Add(newRole);

        _db.AuditLogs.Add(new AuditLog
        {
            CompanyId = null,
            Timestamp = DateTime.UtcNow,
            ActorName = "Super Admin",
            ActorEmail = _currentUser.Email ?? "yanosh@ghlindiaventures.com",
            Action = "CREATE_ROLE",
            EntityType = "Role",
            EntityId = newRole.Code,
            Details = $"Super Admin created custom role '{newRole.Name}' ({newRole.Code}).",
            Module = "Roles",
            Status = "success"
        });

        await _db.SaveChangesAsync(ct);

        var resultDto = new PlatformRoleDto
        {
            Id = newRole.Id.ToString(),
            Name = newRole.Name,
            Code = newRole.Code,
            Permissions = newRole.Permissions
        };

        return CreatedAtAction(nameof(GetRole), new { idOrCode = newRole.Id }, ApiResponse<PlatformRoleDto>.SuccessResult(resultDto, "Custom role created."));
    }
}
