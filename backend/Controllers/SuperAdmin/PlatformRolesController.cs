using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.SuperAdmin;
using backend.Models.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers.SuperAdmin;

[ApiController]
[Authorize(Roles = "super_admin,company_admin")]
[Route("api/super-admin/roles")]
[Route("api/platform/roles")]
public class PlatformRolesController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public PlatformRolesController(ApplicationDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Retrieves all roles dynamically from database with assigned users count and permission counts.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<PlatformRoleDto>>>> GetAllRoles(
        [FromQuery] string? search,
        [FromQuery] string? type,
        [FromQuery] string? status)
    {
        await EnsureSystemRolesPermissionsInitializedAsync();
        var query = _context.Roles.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(r =>
                r.Name.ToLower().Contains(s) ||
                r.Code.ToLower().Contains(s) ||
                (r.Description != null && r.Description.ToLower().Contains(s)));
        }

        if (!string.IsNullOrWhiteSpace(type) && !type.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            var isSystem = type.Equals("system", StringComparison.OrdinalIgnoreCase) || type.Equals("system_role", StringComparison.OrdinalIgnoreCase);
            query = query.Where(r => r.IsSystemRole == isSystem);
        }

        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            var isActive = status.Equals("active", StringComparison.OrdinalIgnoreCase);
            query = query.Where(r => r.IsActive == isActive);
        }

        var roles = await query
            .OrderByDescending(r => r.IsSystemRole)
            .ThenBy(r => r.Id)
            .ToListAsync();

        // Calculate assigned user counts in one query
        var roleCounts = await _context.Users
            .GroupBy(u => u.RoleId)
            .Select(g => new { RoleId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.RoleId, x => x.Count);

        var result = roles.Select(r => new PlatformRoleDto
        {
            Id = r.Id.ToString(),
            Name = r.Name,
            Code = r.Code,
            Description = r.Description,
            IsSystemRole = r.IsSystemRole,
            IsActive = r.IsActive,
            Permissions = r.Permissions ?? new List<string>(),
            UsersCount = roleCounts.TryGetValue(r.Id, out var count) ? count : 0,
            CreatedBy = r.CreatedBy,
            CreatedAt = r.CreatedAt.ToString("o"),
            UpdatedAt = r.UpdatedAt?.ToString("o")
        }).ToList();

        return Ok(ApiResponse<List<PlatformRoleDto>>.SuccessResult(result));
    }

    /// <summary>
    /// Retrieves a single role by Id or Code.
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<PlatformRoleDto>>> GetRoleById(string id)
    {
        Role? role = null;
        if (int.TryParse(id, out var intId))
        {
            role = await _context.Roles.AsNoTracking().FirstOrDefaultAsync(r => r.Id == intId);
        }
        if (role == null)
        {
            var cleanCode = id.Trim().ToLower();
            role = await _context.Roles.AsNoTracking().FirstOrDefaultAsync(r => r.Code.ToLower() == cleanCode);
        }

        if (role == null)
        {
            return NotFound(ApiResponse<PlatformRoleDto>.FailureResult("Role not found."));
        }

        var usersCount = await _context.Users.CountAsync(u => u.RoleId == role.Id);

        var dto = new PlatformRoleDto
        {
            Id = role.Id.ToString(),
            Name = role.Name,
            Code = role.Code,
            Description = role.Description,
            IsSystemRole = role.IsSystemRole,
            IsActive = role.IsActive,
            Permissions = role.Permissions ?? new List<string>(),
            UsersCount = usersCount,
            CreatedBy = role.CreatedBy,
            CreatedAt = role.CreatedAt.ToString("o"),
            UpdatedAt = role.UpdatedAt?.ToString("o")
        };

        return Ok(ApiResponse<PlatformRoleDto>.SuccessResult(dto));
    }

    /// <summary>
    /// Creates a new custom role with specified permissions.
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "super_admin")]
    public async Task<ActionResult<ApiResponse<PlatformRoleDto>>> CreateRole([FromBody] CreateRoleRequestDto req)
    {
        if (string.IsNullOrWhiteSpace(req.Name))
        {
            return BadRequest(ApiResponse<PlatformRoleDto>.FailureResult("Role name is required."));
        }

        if (string.IsNullOrWhiteSpace(req.Code))
        {
            return BadRequest(ApiResponse<PlatformRoleDto>.FailureResult("Role code is required."));
        }

        var cleanCode = req.Code.Trim().ToLower().Replace(" ", "_").Replace("-", "_");

        // Validate unique Name
        var existingName = await _context.Roles.AnyAsync(r => r.Name.ToLower() == req.Name.Trim().ToLower());
        if (existingName)
        {
            return BadRequest(ApiResponse<PlatformRoleDto>.FailureResult($"A role with the name '{req.Name}' already exists."));
        }

        // Validate unique Code
        var existingCode = await _context.Roles.AnyAsync(r => r.Code.ToLower() == cleanCode);
        if (existingCode)
        {
            return BadRequest(ApiResponse<PlatformRoleDto>.FailureResult($"A role with the code '{cleanCode}' already exists."));
        }

        var newRole = new Role
        {
            Name = req.Name.Trim(),
            Code = cleanCode,
            Description = req.Description?.Trim(),
            IsSystemRole = false,
            IsActive = req.IsActive,
            Permissions = req.Permissions ?? new List<string>(),
            CreatedBy = "Super Admin",
            CreatedAt = DateTime.UtcNow
        };

        _context.Roles.Add(newRole);

        // Audit Trail
        _context.AuditLogs.Add(new AuditLog
        {
            Action = "CREATE_ROLE",
            EntityType = "Role",
            EntityId = cleanCode,
            Details = $"Super Admin created custom role: \"{newRole.Name}\" ({cleanCode}) with {newRole.Permissions.Count} privileges.",
            ActorName = "Super Admin",
            ActorEmail = "admin@platform.com",
            Module = "Roles",
            Status = "success"
        });

        await _context.SaveChangesAsync();

        var resultDto = new PlatformRoleDto
        {
            Id = newRole.Id.ToString(),
            Name = newRole.Name,
            Code = newRole.Code,
            Description = newRole.Description,
            IsSystemRole = newRole.IsSystemRole,
            IsActive = newRole.IsActive,
            Permissions = newRole.Permissions,
            UsersCount = 0,
            CreatedBy = newRole.CreatedBy,
            CreatedAt = newRole.CreatedAt.ToString("o")
        };

        return Ok(ApiResponse<PlatformRoleDto>.SuccessResult(resultDto, "Custom role created successfully."));
    }

    /// <summary>
    /// Updates an existing role (Custom role name/desc/status/permissions, or System role permissions).
    /// </summary>
    [HttpPut("{id}")]
    [Authorize(Roles = "super_admin")]
    public async Task<ActionResult<ApiResponse<PlatformRoleDto>>> UpdateRole(string id, [FromBody] UpdateRoleRequestDto req)
    {
        Role? role = null;
        if (int.TryParse(id, out var intId))
        {
            role = await _context.Roles.FirstOrDefaultAsync(r => r.Id == intId);
        }
        if (role == null)
        {
            var cleanCode = id.Trim().ToLower();
            role = await _context.Roles.FirstOrDefaultAsync(r => r.Code.ToLower() == cleanCode);
        }

        if (role == null)
        {
            return NotFound(ApiResponse<PlatformRoleDto>.FailureResult("Role not found."));
        }

        if (role.IsSystemRole)
        {
            // System roles cannot be renamed or code changed, but permissions can be fine-tuned
            if (req.Permissions != null)
            {
                role.Permissions = req.Permissions;
            }
            if (!string.IsNullOrWhiteSpace(req.Description))
            {
                role.Description = req.Description.Trim();
            }
        }
        else
        {
            // Custom role
            if (!string.IsNullOrWhiteSpace(req.Name))
            {
                var duplicate = await _context.Roles.AnyAsync(r => r.Id != role.Id && r.Name.ToLower() == req.Name.Trim().ToLower());
                if (duplicate)
                {
                    return BadRequest(ApiResponse<PlatformRoleDto>.FailureResult($"A role with the name '{req.Name}' already exists."));
                }
                role.Name = req.Name.Trim();
            }

            if (req.Description != null)
            {
                role.Description = req.Description.Trim();
            }

            if (req.IsActive.HasValue)
            {
                role.IsActive = req.IsActive.Value;
            }

            if (req.Permissions != null)
            {
                role.Permissions = req.Permissions;
            }
        }

        role.UpdatedAt = DateTime.UtcNow;

        _context.AuditLogs.Add(new AuditLog
        {
            Action = "UPDATE_ROLE",
            EntityType = "Role",
            EntityId = role.Code,
            Details = $"Super Admin updated role: \"{role.Name}\" ({role.Code}) with {role.Permissions.Count} privileges.",
            ActorName = "Super Admin",
            ActorEmail = "admin@platform.com",
            Module = "Roles",
            Status = "success"
        });

        await _context.SaveChangesAsync();

        var usersCount = await _context.Users.CountAsync(u => u.RoleId == role.Id);

        var dto = new PlatformRoleDto
        {
            Id = role.Id.ToString(),
            Name = role.Name,
            Code = role.Code,
            Description = role.Description,
            IsSystemRole = role.IsSystemRole,
            IsActive = role.IsActive,
            Permissions = role.Permissions,
            UsersCount = usersCount,
            CreatedBy = role.CreatedBy,
            CreatedAt = role.CreatedAt.ToString("o"),
            UpdatedAt = role.UpdatedAt?.ToString("o")
        };

        return Ok(ApiResponse<PlatformRoleDto>.SuccessResult(dto, "Role updated successfully."));
    }

    /// <summary>
    /// Activates or deactivates a custom role.
    /// </summary>
    [HttpPatch("{id}/status")]
    [Authorize(Roles = "super_admin")]
    public async Task<ActionResult<ApiResponse<PlatformRoleDto>>> ToggleRoleStatus(string id, [FromBody] UpdateRoleStatusDto req)
    {
        Role? role = null;
        if (int.TryParse(id, out var intId))
        {
            role = await _context.Roles.FirstOrDefaultAsync(r => r.Id == intId);
        }
        if (role == null)
        {
            var cleanCode = id.Trim().ToLower();
            role = await _context.Roles.FirstOrDefaultAsync(r => r.Code.ToLower() == cleanCode);
        }

        if (role == null)
        {
            return NotFound(ApiResponse<PlatformRoleDto>.FailureResult("Role not found."));
        }

        if (role.IsSystemRole && !req.IsActive)
        {
            return BadRequest(ApiResponse<PlatformRoleDto>.FailureResult("System roles cannot be deactivated."));
        }

        role.IsActive = req.IsActive;
        role.UpdatedAt = DateTime.UtcNow;

        _context.AuditLogs.Add(new AuditLog
        {
            Action = req.IsActive ? "ACTIVATE_ROLE" : "DEACTIVATE_ROLE",
            EntityType = "Role",
            EntityId = role.Code,
            Details = $"Super Admin {(req.IsActive ? "activated" : "deactivated")} role \"{role.Name}\".",
            ActorName = "Super Admin",
            ActorEmail = "admin@platform.com",
            Module = "Roles",
            Status = "success"
        });

        await _context.SaveChangesAsync();

        var usersCount = await _context.Users.CountAsync(u => u.RoleId == role.Id);

        var dto = new PlatformRoleDto
        {
            Id = role.Id.ToString(),
            Name = role.Name,
            Code = role.Code,
            Description = role.Description,
            IsSystemRole = role.IsSystemRole,
            IsActive = role.IsActive,
            Permissions = role.Permissions,
            UsersCount = usersCount,
            CreatedBy = role.CreatedBy,
            CreatedAt = role.CreatedAt.ToString("o"),
            UpdatedAt = role.UpdatedAt?.ToString("o")
        };

        return Ok(ApiResponse<PlatformRoleDto>.SuccessResult(dto, $"Role {(req.IsActive ? "activated" : "deactivated")} successfully."));
    }

    /// <summary>
    /// Safely deletes a custom role. Prevents deletion of system roles and roles with active assigned users.
    /// </summary>
    [HttpDelete("{id}")]
    [Authorize(Roles = "super_admin")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteRole(string id)
    {
        Role? role = null;
        if (int.TryParse(id, out var intId))
        {
            role = await _context.Roles.FirstOrDefaultAsync(r => r.Id == intId);
        }
        if (role == null)
        {
            var cleanCode = id.Trim().ToLower();
            role = await _context.Roles.FirstOrDefaultAsync(r => r.Code.ToLower() == cleanCode);
        }

        if (role == null)
        {
            return NotFound(ApiResponse<bool>.FailureResult("Role not found."));
        }

        if (role.IsSystemRole)
        {
            return BadRequest(ApiResponse<bool>.FailureResult("System roles are protected and cannot be deleted."));
        }

        var assignedUsersCount = await _context.Users.CountAsync(u => u.RoleId == role.Id);
        if (assignedUsersCount > 0)
        {
            return BadRequest(ApiResponse<bool>.FailureResult(
                $"Cannot delete role '{role.Name}' because {assignedUsersCount} user(s) are currently assigned to it. Please reassign those users to a different role first."));
        }

        _context.Roles.Remove(role);

        _context.AuditLogs.Add(new AuditLog
        {
            Action = "DELETE_ROLE",
            EntityType = "Role",
            EntityId = role.Code,
            Details = $"Super Admin deleted custom role \"{role.Name}\" ({role.Code}).",
            ActorName = "Super Admin",
            ActorEmail = "admin@platform.com",
            Module = "Roles",
            Status = "success"
        });

        await _context.SaveChangesAsync();

        return Ok(ApiResponse<bool>.SuccessResult(true, "Role deleted successfully."));
    }

    /// <summary>
    /// Returns the canonical system permissions list grouped by module.
    /// </summary>
    [HttpGet("~/api/super-admin/permissions")]
    [HttpGet("~/api/platform/permissions")]
    public ActionResult<ApiResponse<List<PermissionGroupDto>>> GetAvailablePermissions()
    {
        var groups = new List<PermissionGroupDto>
        {
            new PermissionGroupDto
            {
                Group = "Dashboard & Workspace",
                Items = new List<PermissionItemDto>
                {
                    new() { Key = "dashboard.view", Label = "View Dashboard", Description = "Access live operational command dashboard and key metrics" },
                    new() { Key = "notifications.view", Label = "View Notifications", Description = "Access notification center and compliance alert broadcasts" },
                    new() { Key = "profile.view", Label = "View / Manage Profile", Description = "View user personal profile, contact information, and security" }
                }
            },
            new PermissionGroupDto
            {
                Group = "Inbound Leads Management",
                Items = new List<PermissionItemDto>
                {
                    new() { Key = "leads.view", Label = "View Leads", Description = "Browse and inspect inbound and assigned lead profiles" },
                    new() { Key = "leads.assigned.view", Label = "View Assigned Leads", Description = "Access the assigned leads queue and delegation table" },
                    new() { Key = "leads.pending.view", Label = "View Pending Leads", Description = "Access the pending lead verification and triage queue" },
                    new() { Key = "leads.archived.view", Label = "View Archived Leads", Description = "Inspect archived and closed prospect records" },
                    new() { Key = "leads.create", Label = "Create Lead", Description = "Manually register prospective contact records" },
                    new() { Key = "leads.update", Label = "Update Lead", Description = "Modify contact information, intent tags, and custom fields" },
                    new() { Key = "leads.delete", Label = "Delete Lead", Description = "Permanently remove or archive lead records" },
                    new() { Key = "leads.assign", Label = "Assign Lead", Description = "Re-route or delegate leads to individual sales reps" },
                    new() { Key = "leads.convert", Label = "Convert Lead", Description = "Execute conversion workflow from Lead to Customer 360" },
                    new() { Key = "leads.export", Label = "Export Leads CSV", Description = "Download CSV dumps of company lead tables" },
                    new() { Key = "leads.import", Label = "Import Leads CSV", Description = "Batch ingest contacts with custom column mapping" }
                }
            },
            new PermissionGroupDto
            {
                Group = "Customer 360 & Commercial Deals",
                Items = new List<PermissionItemDto>
                {
                    new() { Key = "customers.view", Label = "View Customers 360", Description = "Access Customer 360 profiles and interaction timelines" },
                    new() { Key = "customers.converted.view", Label = "View Converted Customers", Description = "Inspect converted client records and onboarding files" },
                    new() { Key = "customers.create", Label = "Create Customer", Description = "Manually register confirmed institutional/buyer accounts" },
                    new() { Key = "customers.update", Label = "Update Customer", Description = "Modify contact details, VIP badges, and custom notes" },
                    new() { Key = "customers.delete", Label = "Delete Customer", Description = "Deactivate or purge customer records" },
                    new() { Key = "deals.view", Label = "View Pipeline & Deals", Description = "Access Kanban pipeline stages and revenue values" },
                    new() { Key = "deals.create", Label = "Create Deal", Description = "Add new commercial deal to active pipeline" },
                    new() { Key = "deals.update", Label = "Update Deal & Stage", Description = "Move deals across stages and adjust close probability" },
                    new() { Key = "deals.delete", Label = "Delete Deal", Description = "Purge deal records from company pipeline" }
                }
            },
            new PermissionGroupDto
            {
                Group = "Telephony & Live Softphone Calling",
                Items = new List<PermissionItemDto>
                {
                    new() { Key = "calls.make", Label = "Call Center (Dialer)", Description = "Trigger outgoing WebRTC/SIP calls via softphone" },
                    new() { Key = "calls.receive", Label = "Receive Inbound Calls", Description = "Accept inbound incoming calls routed to queue" },
                    new() { Key = "calls.view", Label = "View Call History", Description = "Inspect call center history, durations, and dispositions" },
                    new() { Key = "calls.recordings.play", Label = "Playback Call Audio", Description = "Stream voice recordings and review speech transcripts" },
                    new() { Key = "calls.settings.view", Label = "View Call Settings", Description = "Access dialer preferences, audio devices, and telephony settings" }
                }
            },
            new PermissionGroupDto
            {
                Group = "Follow-ups & Task Reminders",
                Items = new List<PermissionItemDto>
                {
                    new() { Key = "followups.view", Label = "View Tasks & Follow-ups", Description = "Inspect scheduled callback agenda and reminders" },
                    new() { Key = "followups.create", Label = "Schedule Follow-up", Description = "Book upcoming callbacks, meetings, or tasks" },
                    new() { Key = "followups.update", Label = "Complete / Reschedule", Description = "Mark follow-up completed or reschedule slot" }
                }
            },
            new PermissionGroupDto
            {
                Group = "Operations & Real Estate (Jamin)",
                Items = new List<PermissionItemDto>
                {
                    new() { Key = "properties.view", Label = "View Layouts & Plots", Description = "Browse project inventory and plot status availability" },
                    new() { Key = "properties.update", Label = "Update Plot Status", Description = "Put plots on Hold or release reservations" },
                    new() { Key = "site_visits.view", Label = "View Site Visits", Description = "Inspect prospective buyer layout tour calendar" },
                    new() { Key = "site_visits.create", Label = "Schedule Site Visit", Description = "Book customer layout tour with driver escort" },
                    new() { Key = "bookings.view", Label = "View Plot Bookings", Description = "Inspect token advances and allotment documentation" },
                    new() { Key = "bookings.create", Label = "Execute Booking", Description = "Record token receipt and transition plot to Sold" }
                }
            },
            new PermissionGroupDto
            {
                Group = "Wealth Advisory & Investors (GHL)",
                Items = new List<PermissionItemDto>
                {
                    new() { Key = "investors.view", Label = "View HNW Investors", Description = "Access Ultra-HNI capital allocation and mandate profiles" },
                    new() { Key = "investors.create", Label = "Create Investor", Description = "Onboard new accredited family office or institutional investor" },
                    new() { Key = "consultations.view", Label = "View Consultations", Description = "Inspect private wealth advisory session schedules" },
                    new() { Key = "consultations.create", Label = "Book Consultation", Description = "Schedule 1-on-1 private wealth advisory consultations" },
                    new() { Key = "opportunities.view", Label = "View CRE Opportunities", Description = "Browse commercial real estate syndication tranches" },
                    new() { Key = "opportunities.create", Label = "Create Opportunity", Description = "List new investment tranche with target yield" },
                    new() { Key = "kyc.verify", Label = "KYC Leads & Verification", Description = "Review KYC identity documents and compliance verification" }
                }
            },
            new PermissionGroupDto
            {
                Group = "Administration & Team Management",
                Items = new List<PermissionItemDto>
                {
                    new() { Key = "documents.view", Label = "Company Documents / Collaterals", Description = "Access company documents repository and sales collaterals" },
                    new() { Key = "documents.manage", Label = "Manage Company Documents", Description = "Upload, update, and delete company documents and collaterals" },
                    new() { Key = "users.view", Label = "View Team Directory", Description = "Browse employee list and sales team structures" },
                    new() { Key = "users.manage", Label = "Manage Team Users", Description = "Invite reps, modify quotas, and change user roles" },
                    new() { Key = "work_handover.view", Label = "View Work Handover", Description = "Access team member delegation and account handover logs" },
                    new() { Key = "leave_requests.view", Label = "View Leave Requests", Description = "Submit and inspect personal and team leave requests" },
                    new() { Key = "audit.view", Label = "View Audit Logs", Description = "Inspect tamper-evident compliance audit trails" },
                    new() { Key = "settings.view", Label = "View Company Settings", Description = "Inspect organization branding, hours, and timezone" },
                    new() { Key = "settings.update", Label = "Update Company Settings", Description = "Modify branding colors, lead SLA timers, and company details" }
                }
            },
            new PermissionGroupDto
            {
                Group = "Collaboration & AI Support",
                Items = new List<PermissionItemDto>
                {
                    new() { Key = "support.view", Label = "Helpdesk & Support", Description = "Access internal ticket creation, helpdesk, and tenant support" },
                    new() { Key = "chat.view", Label = "View Team Chat", Description = "Access peer-to-peer and group messaging channels" },
                    new() { Key = "chat.send", Label = "Send Chat Messages", Description = "Post messages, share documents, and react in channels" },
                    new() { Key = "smarty_ai.view", Label = "Smarty AI Assistant", Description = "Interact with the Smarty generative AI advisor" }
                }
            },
            new PermissionGroupDto
            {
                Group = "Platform Governance (Super Admin)",
                Items = new List<PermissionItemDto>
                {
                    new() { Key = "roles.view", Label = "View Roles & Permissions", Description = "Inspect platform RBAC hierarchy and permission matrix" },
                    new() { Key = "roles.manage", Label = "Manage Roles & Permissions", Description = "Create custom roles and modify permission assignments" },
                    new() { Key = "platform.companies.manage", Label = "Manage Tenant Companies", Description = "Provision, configure, and govern client tenant organizations" },
                    new() { Key = "platform.packages.manage", Label = "Manage Feature Packages", Description = "Create and assign subscription tiers and feature catalogs" },
                    new() { Key = "platform.call_config.manage", Label = "Manage SIP & DID Routing", Description = "Configure telephony SIP trunks and inbound DID hotlines" }
                }
            }
        };

        return Ok(ApiResponse<List<PermissionGroupDto>>.SuccessResult(groups));
    }

    private static List<string> GetAllKnownPermissionKeys()
    {
        return new List<string>
        {
            "dashboard.view", "notifications.view", "profile.view",
            "leads.view", "leads.assigned.view", "leads.pending.view", "leads.archived.view",
            "leads.create", "leads.update", "leads.delete", "leads.assign", "leads.convert", "leads.export", "leads.import",
            "customers.view", "customers.converted.view", "customers.create", "customers.update", "customers.delete",
            "deals.view", "deals.create", "deals.update", "deals.delete",
            "calls.make", "calls.receive", "calls.view", "calls.recordings.play", "calls.settings.view",
            "followups.view", "followups.create", "followups.update",
            "properties.view", "properties.update", "site_visits.view", "site_visits.create", "bookings.view", "bookings.create",
            "investors.view", "investors.create", "consultations.view", "consultations.create", "opportunities.view", "opportunities.create", "kyc.verify",
            "reports.view", "reports.export",
            "documents.view", "documents.manage", "users.view", "users.manage", "work_handover.view", "leave_requests.view", "audit.view",
            "settings.view", "settings.update",
            "support.view", "chat.view", "chat.send", "smarty_ai.view",
            "roles.view", "roles.manage", "platform.companies.manage", "platform.packages.manage", "platform.call_config.manage"
        };
    }

    private async Task EnsureSystemRolesPermissionsInitializedAsync()
    {
        var initSetting = await _context.PlatformSettings.FirstOrDefaultAsync(s => s.Key == "sidebar_rbac_initialized_v2");
        if (initSetting != null && initSetting.Value == "true")
        {
            return;
        }

        var roles = await _context.Roles.Where(r => r.IsSystemRole).ToListAsync();
        bool modified = false;

        foreach (var role in roles)
        {
            var perms = role.Permissions ?? new List<string>();
            var set = new HashSet<string>(perms);
            int origCount = set.Count;

            if (role.Code == "super_admin")
            {
                foreach (var k in GetAllKnownPermissionKeys()) set.Add(k);
            }
            else if (role.Code == "company_admin")
            {
                string[] caDefaults = {
                    "dashboard.view", "leads.assigned.view", "leads.pending.view", "leads.archived.view",
                    "customers.converted.view", "calls.settings.view", "notifications.view",
                    "documents.view", "documents.manage", "work_handover.view", "leave_requests.view",
                    "support.view", "chat.view", "chat.send", "smarty_ai.view", "profile.view"
                };
                foreach (var k in caDefaults) set.Add(k);
            }
            else if (role.Code == "sales_executive")
            {
                string[] seDefaults = {
                    "dashboard.view", "calls.settings.view", "notifications.view",
                    "documents.view", "leave_requests.view",
                    "support.view", "chat.view", "chat.send", "smarty_ai.view", "profile.view"
                };
                foreach (var k in seDefaults) set.Add(k);
            }
            else if (role.Code == "irm")
            {
                string[] irmDefaults = {
                    "dashboard.view", "calls.settings.view", "notifications.view",
                    "documents.view", "leave_requests.view",
                    "support.view", "chat.view", "chat.send", "smarty_ai.view", "profile.view"
                };
                foreach (var k in irmDefaults) set.Add(k);
            }

            if (set.Count != origCount)
            {
                role.Permissions = set.ToList();
                role.UpdatedAt = DateTime.UtcNow;
                modified = true;
            }
        }

        if (initSetting == null)
        {
            _context.PlatformSettings.Add(new PlatformSetting
            {
                Key = "sidebar_rbac_initialized_v2",
                Value = "true",
                Description = "Ensures sidebar permissions are populated once into system roles",
                UpdatedAt = DateTime.UtcNow
            });
            modified = true;
        }
        else
        {
            initSetting.Value = "true";
            initSetting.UpdatedAt = DateTime.UtcNow;
            modified = true;
        }

        if (modified)
        {
            await _context.SaveChangesAsync();
        }
    }
}
