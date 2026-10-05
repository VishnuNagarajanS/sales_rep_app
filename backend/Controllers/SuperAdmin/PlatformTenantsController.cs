using backend.Authentication.Interfaces;
using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.SuperAdmin;
using backend.Hubs;
using backend.Models.Entities;
using backend.Models.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers.SuperAdmin;

[ApiController]
[Authorize(Roles = "super_admin")]
[Route("api/super-admin/tenants")]
public class PlatformTenantsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;
    private readonly IHubContext<PlatformHub, IPlatformHubClient> _hubContext;

    public PlatformTenantsController(
        ApplicationDbContext context,
        ICurrentUserService currentUser,
        IHubContext<PlatformHub, IPlatformHubClient> hubContext)
    {
        _context = context;
        _currentUser = currentUser;
        _hubContext = hubContext;
    }

    [HttpGet]
    [HttpGet("~/api/platform/tenants")]
    public async Task<ActionResult<ApiResponse<List<TenantResponseDto>>>> GetAllTenants(CancellationToken ct = default)
    {
        var tenants = await _context.Tenants
            .AsNoTracking()
            .OrderBy(t => t.Id)
            .ToListAsync(ct);

        // Compute real live telemetry aggregations across database
        var userStats = await _context.Users
            .Where(u => u.CompanyId.HasValue)
            .GroupBy(u => u.CompanyId!.Value)
            .Select(g => new
            {
                TenantId = g.Key,
                Total = g.Count(),
                Active = g.Count(u => u.Status == UserStatus.Active)
            })
            .ToDictionaryAsync(x => x.TenantId, x => x, ct);

        var leadStats = await _context.Leads
            .GroupBy(l => l.CompanyId)
            .Select(g => new { TenantId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.TenantId, x => x.Count, ct);

        var customerStats = await _context.Customers
            .GroupBy(c => c.CompanyId)
            .Select(g => new { TenantId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.TenantId, x => x.Count, ct);

        var didStats = await _context.TenantDidMappings
            .Where(d => d.TenantId.HasValue)
            .GroupBy(d => d.TenantId!.Value)
            .Select(g => new { TenantId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.TenantId, x => x.Count, ct);

        var callStats = await _context.CallRecords
            .GroupBy(c => c.CompanyId)
            .Select(g => new { TenantId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.TenantId, x => x.Count, ct);

        var dtos = tenants.Select(t =>
        {
            var uStat = userStats.TryGetValue(t.Id, out var us) ? us : null;
            var lCount = leadStats.TryGetValue(t.Id, out var lc) ? lc : 0;
            var cCount = customerStats.TryGetValue(t.Id, out var cc) ? cc : 0;
            var dCount = didStats.TryGetValue(t.Id, out var dc) ? dc : 0;
            var callCount = callStats.TryGetValue(t.Id, out var cal) ? cal : 0;

            var dto = MapToResponseDto(t);
            dto.UsersCount = uStat?.Total ?? 0;
            dto.ActiveUsersCount = uStat?.Active ?? 0;
            dto.LeadsCount = lCount;
            dto.CustomersCount = cCount;
            dto.CallsCount = callCount;
            dto.DidsCount = dCount;
            dto.IsProtected = t.IsProtected;
            return dto;
        }).ToList();

        return Ok(ApiResponse<List<TenantResponseDto>>.SuccessResult(dtos));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<TenantResponseDto>>> GetTenantById(string id, CancellationToken ct = default)
    {
        var tenant = await FindTenantAsync(id, ct);
        if (tenant == null)
            return NotFound(ApiResponse<TenantResponseDto>.FailureResult("Tenant organization not found."));

        var totalUsers = await _context.Users.CountAsync(u => u.CompanyId == tenant.Id, ct);
        var activeUsers = await _context.Users.CountAsync(u => u.CompanyId == tenant.Id && u.Status == UserStatus.Active, ct);
        var leadsCount = await _context.Leads.CountAsync(l => l.CompanyId == tenant.Id, ct);
        var customersCount = await _context.Customers.CountAsync(c => c.CompanyId == tenant.Id, ct);
        var didsCount = await _context.TenantDidMappings.CountAsync(d => d.TenantId == tenant.Id, ct);
        var callsCount = await _context.CallRecords.CountAsync(c => c.CompanyId == tenant.Id, ct);

        var dto = MapToResponseDto(tenant);
        dto.UsersCount = totalUsers;
        dto.ActiveUsersCount = activeUsers;
        dto.LeadsCount = leadsCount;
        dto.CustomersCount = customersCount;
        dto.CallsCount = callsCount;
        dto.DidsCount = didsCount;
        dto.IsProtected = tenant.IsProtected;

        return Ok(ApiResponse<TenantResponseDto>.SuccessResult(dto));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<TenantResponseDto>>> CreateTenant(
        [FromBody] CreateTenantRequestDto req,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(req.Name))
            return BadRequest(ApiResponse<TenantResponseDto>.FailureResult("Tenant name is required."));

        var cleanSlug = (req.Slug ?? req.Name)
            .ToLowerInvariant()
            .Trim();
        cleanSlug = System.Text.RegularExpressions.Regex.Replace(cleanSlug, @"[^a-z0-9]", "");
        if (string.IsNullOrWhiteSpace(cleanSlug))
            cleanSlug = $"tenant{DateTime.UtcNow.Ticks % 10000}";

        var existingSlug = await _context.Tenants.AnyAsync(t => t.Slug.ToLower() == cleanSlug, ct);
        if (existingSlug)
            return BadRequest(ApiResponse<TenantResponseDto>.FailureResult($"A tenant with identifier '{cleanSlug}' already exists."));

        var status = string.IsNullOrWhiteSpace(req.Status) ? "Active" : req.Status;
        var isActive = status.Equals("Active", StringComparison.OrdinalIgnoreCase);

        var tenant = new Tenant
        {
            Name = req.Name.Trim(),
            LegalName = req.LegalName?.Trim() ?? req.Name.Trim(),
            Slug = cleanSlug,
            BrandColor = req.BrandColor ?? "#8b5cf6",
            Logo = req.Logo,
            Tagline = req.Tagline?.Trim() ?? "Enterprise Sales Organization",
            Industry = req.Industry?.Trim() ?? "Commercial Real Estate",
            EnabledFeatures = req.EnabledFeatures ?? new List<string> { "leads", "customers", "deals", "calls", "reports" },
            Timezone = req.Timezone ?? "Asia/Kolkata (IST)",
            Currency = req.Currency ?? "₹ INR",
            BusinessHours = req.BusinessHours ?? "09:30 AM - 06:30 PM IST",
            Status = status,
            IsActive = isActive,
            SubscriptionPlan = req.SubscriptionPlan ?? "Starter CRM Tier",
            LeadSla = req.LeadSla ?? 30,
            CallEnabled = req.CallEnabled ?? true,
            RecordingEnabled = req.RecordingEnabled ?? true,
            TranscriptionEnabled = req.TranscriptionEnabled ?? true,
            CreatedAt = DateTime.UtcNow
        };

        _context.Tenants.Add(tenant);
        await _context.SaveChangesAsync(ct);

        // Optional provision of Company Admin user
        if (req.AdminUser != null && !string.IsNullOrWhiteSpace(req.AdminUser.Email))
        {
            var adminRole = await _context.Roles.FirstOrDefaultAsync(r => r.Code == "company_admin", ct);
            if (adminRole != null)
            {
                var adminUser = new User
                {
                    Name = req.AdminUser.Name.Trim(),
                    Email = req.AdminUser.Email.Trim().ToLowerInvariant(),
                    Phone = req.AdminUser.Phone?.Trim() ?? string.Empty,
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(string.IsNullOrWhiteSpace(req.AdminUser.Password) ? "Password@123" : req.AdminUser.Password),
                    RoleId = adminRole.Id,
                    CompanyId = tenant.Id,
                    Status = UserStatus.Active,
                    CreatedAt = DateTime.UtcNow
                };

                _context.Users.Add(adminUser);
            }
        }

        // Optional DID assignment
        if (req.Did != null && !string.IsNullOrWhiteSpace(req.Did.PhoneNumber))
        {
            var did = new TenantDidMapping
            {
                TenantId = tenant.Id,
                PhoneNumber = req.Did.PhoneNumber.Trim(),
                RoutingStrategy = req.Did.RoutingStrategy ?? "round_robin",
                QueueName = $"{tenant.Slug}-general-queue",
                Status = "Online",
                CreatedAt = DateTime.UtcNow
            };
            _context.TenantDidMappings.Add(did);
        }

        _context.AuditLogs.Add(new AuditLog
        {
            Action = "CREATE_TENANT",
            EntityType = "Tenant",
            EntityId = tenant.Id.ToString(),
            CompanyId = tenant.Id,
            ActorName = _currentUser.Email ?? "Super Admin",
            ActorEmail = _currentUser.Email ?? "admin@platform.com",
            Details = $"Super Admin created tenant organization: \"{tenant.Name}\" ({cleanSlug}).",
            Module = "Companies",
            Status = "success",
            Timestamp = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(ct);

        try
        {
            await _hubContext.Clients.All.PlatformDataUpdated("Tenant", "Created");
        }
        catch { }

        return CreatedAtAction(nameof(GetTenantById), new { id = tenant.Id }, ApiResponse<TenantResponseDto>.SuccessResult(MapToResponseDto(tenant), "Tenant organization created successfully."));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<ApiResponse<TenantResponseDto>>> UpdateTenant(
        string id,
        [FromBody] UpdateTenantRequestDto req,
        CancellationToken ct = default)
    {
        var tenant = await FindTenantAsync(id, ct);
        if (tenant == null)
            return NotFound(ApiResponse<TenantResponseDto>.FailureResult("Tenant organization not found."));

        if (!string.IsNullOrWhiteSpace(req.Name))
            tenant.Name = req.Name.Trim();

        if (req.LegalName != null)
            tenant.LegalName = req.LegalName.Trim();

        if (!string.IsNullOrWhiteSpace(req.Slug))
        {
            var clean = req.Slug.ToLowerInvariant().Trim();
            clean = System.Text.RegularExpressions.Regex.Replace(clean, @"[^a-z0-9]", "");
            if (clean != tenant.Slug)
            {
                var conflict = await _context.Tenants.AnyAsync(t => t.Slug == clean && t.Id != tenant.Id, ct);
                if (conflict)
                    return BadRequest(ApiResponse<TenantResponseDto>.FailureResult($"Slug '{clean}' is already in use by another tenant."));
                tenant.Slug = clean;
            }
        }

        if (req.BrandColor != null) tenant.BrandColor = req.BrandColor;
        if (req.Logo != null) tenant.Logo = req.Logo;
        if (req.Tagline != null) tenant.Tagline = req.Tagline.Trim();
        if (req.Industry != null) tenant.Industry = req.Industry.Trim();
        if (req.Timezone != null) tenant.Timezone = req.Timezone;
        if (req.Currency != null) tenant.Currency = req.Currency;
        if (req.BusinessHours != null) tenant.BusinessHours = req.BusinessHours;
        if (req.SubscriptionPlan != null) tenant.SubscriptionPlan = req.SubscriptionPlan;
        if (req.LeadSla.HasValue) tenant.LeadSla = req.LeadSla.Value;
        if (req.CallEnabled.HasValue) tenant.CallEnabled = req.CallEnabled.Value;
        if (req.RecordingEnabled.HasValue) tenant.RecordingEnabled = req.RecordingEnabled.Value;
        if (req.TranscriptionEnabled.HasValue) tenant.TranscriptionEnabled = req.TranscriptionEnabled.Value;
        if (req.EnabledFeatures != null) tenant.EnabledFeatures = req.EnabledFeatures;

        if (!string.IsNullOrWhiteSpace(req.Status))
        {
            tenant.Status = req.Status;
            tenant.IsActive = req.Status.Equals("Active", StringComparison.OrdinalIgnoreCase);
        }

        tenant.UpdatedAt = DateTime.UtcNow;

        _context.AuditLogs.Add(new AuditLog
        {
            Action = "UPDATE_TENANT",
            EntityType = "Tenant",
            EntityId = tenant.Id.ToString(),
            CompanyId = tenant.Id,
            ActorName = _currentUser.Email ?? "Super Admin",
            ActorEmail = _currentUser.Email ?? "admin@platform.com",
            Details = $"Super Admin updated configuration for tenant organization: \"{tenant.Name}\".",
            Module = "Companies",
            Status = "success",
            Timestamp = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(ct);

        try
        {
            await _hubContext.Clients.All.PlatformDataUpdated("Tenant", "Updated");
        }
        catch { }

        return Ok(ApiResponse<TenantResponseDto>.SuccessResult(MapToResponseDto(tenant), "Tenant configuration updated successfully."));
    }

    [HttpPatch("{id}/status")]
    public async Task<ActionResult<ApiResponse<TenantResponseDto>>> UpdateTenantStatus(
        string id,
        [FromBody] TenantStatusUpdateDto req,
        CancellationToken ct = default)
    {
        var tenant = await FindTenantAsync(id, ct);
        if (tenant == null)
            return NotFound(ApiResponse<TenantResponseDto>.FailureResult("Tenant organization not found."));

        if (tenant.IsProtected && req.Status.Equals("Suspended", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(ApiResponse<TenantResponseDto>.FailureResult(
                $"Tenant organization '{tenant.Name}' is a protected core enterprise organization and cannot be suspended."));
        }

        var previousStatus = tenant.Status ?? (tenant.IsActive ? "Active" : "Inactive");
        tenant.Status = req.Status;
        tenant.IsActive = req.Status.Equals("Active", StringComparison.OrdinalIgnoreCase);
        tenant.UpdatedAt = DateTime.UtcNow;

        // If suspending tenant, revoke all active sessions for its users
        if (req.Status.Equals("Suspended", StringComparison.OrdinalIgnoreCase))
        {
            var tenantUserIds = await _context.Users.Where(u => u.CompanyId == tenant.Id).Select(u => u.Id).ToListAsync(ct);
            var activeSessions = await _context.UserSessions.Where(s => tenantUserIds.Contains(s.UserId) && s.IsActive).ToListAsync(ct);
            foreach (var s in activeSessions)
            {
                s.IsActive = false;
                s.RevokedAt = DateTime.UtcNow;
                s.RevokedReason = $"Tenant organization '{tenant.Name}' was suspended.";
            }

            try
            {
                await _hubContext.Clients.Group($"tenant_{tenant.Id}").TenantSuspended(tenant.Id, $"Organization '{tenant.Name}' has been suspended by platform administration.");
            }
            catch { }
        }
        else if (req.Status.Equals("Active", StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                await _hubContext.Clients.Group($"tenant_{tenant.Id}").TenantActivated(tenant.Id);
            }
            catch { }
        }

        _context.AuditLogs.Add(new AuditLog
        {
            Action = "STATUS_CHANGE",
            EntityType = "Tenant",
            EntityId = tenant.Id.ToString(),
            CompanyId = tenant.Id,
            ActorName = _currentUser.Email ?? "Super Admin",
            ActorEmail = _currentUser.Email ?? "admin@platform.com",
            Details = $"Organization \"{tenant.Name}\" status changed from {previousStatus} to {req.Status}.",
            Module = "Companies",
            Status = "success",
            Timestamp = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(ct);

        try
        {
            await _hubContext.Clients.All.PlatformDataUpdated("Tenant", "StatusChanged");
        }
        catch { }

        return Ok(ApiResponse<TenantResponseDto>.SuccessResult(MapToResponseDto(tenant), "Status updated successfully."));
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteTenant(string id, CancellationToken ct = default)
    {
        var tenant = await FindTenantAsync(id, ct);
        if (tenant == null)
            return NotFound(ApiResponse<bool>.FailureResult("Tenant organization not found."));

        // Enforce protection via explicit entity flag
        if (tenant.IsProtected)
            return BadRequest(ApiResponse<bool>.FailureResult($"Tenant '{tenant.Name}' is a protected core enterprise organization and cannot be deleted."));

        var tenantName = tenant.Name;
        var tenantId = tenant.Id;

        _context.Tenants.Remove(tenant);

        _context.AuditLogs.Add(new AuditLog
        {
            Action = "DELETE_TENANT",
            EntityType = "Tenant",
            EntityId = tenantId.ToString(),
            ActorName = _currentUser.Email ?? "Super Admin",
            ActorEmail = _currentUser.Email ?? "admin@platform.com",
            Details = $"Super Admin deleted tenant organization: \"{tenantName}\" (ID: {tenantId}).",
            Module = "Companies",
            Status = "success",
            Timestamp = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(ct);

        try
        {
            await _hubContext.Clients.All.PlatformDataUpdated("Tenant", "Deleted");
        }
        catch { }

        return Ok(ApiResponse<bool>.SuccessResult(true, $"Tenant '{tenantName}' deleted successfully."));
    }

    private async Task<Tenant?> FindTenantAsync(string id, CancellationToken ct)
    {
        if (int.TryParse(id, out var intId))
            return await _context.Tenants.FirstOrDefaultAsync(t => t.Id == intId, ct);

        var slug = id.Trim().ToLower();
        return await _context.Tenants.FirstOrDefaultAsync(t => t.Slug.ToLower() == slug, ct);
    }

    private static TenantResponseDto MapToResponseDto(Tenant t)
    {
        return new TenantResponseDto
        {
            Id = t.Id.ToString(),
            Name = t.Name,
            Slug = t.Slug,
            BrandColor = t.BrandColor,
            Logo = t.Logo,
            Tagline = t.Tagline,
            EnabledFeatures = t.EnabledFeatures,
            Timezone = t.Timezone,
            Currency = t.Currency,
            BusinessHours = t.BusinessHours,
            Status = t.Status ?? (t.IsActive ? "Active" : "Inactive"),
            LegalName = t.LegalName ?? t.Name,
            Industry = t.Industry ?? "Commercial Real Estate",
            SubscriptionPlan = t.SubscriptionPlan ?? "Starter CRM Tier",
            LeadSla = t.LeadSla ?? 30,
            CallEnabled = t.CallEnabled,
            RecordingEnabled = t.RecordingEnabled,
            TranscriptionEnabled = t.TranscriptionEnabled,
            IsProtected = t.IsProtected,
            CreatedAt = t.CreatedAt,
            UpdatedAt = t.UpdatedAt
        };
    }
}
