using System.IO.Compression;
using System.Text;
using System.Text.Json;
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
    private readonly IJwtService _jwtService;

    public PlatformTenantsController(
        ApplicationDbContext context,
        ICurrentUserService currentUser,
        IHubContext<PlatformHub, IPlatformHubClient> hubContext,
        IJwtService jwtService)
    {
        _context = context;
        _currentUser = currentUser;
        _hubContext = hubContext;
        _jwtService = jwtService;
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
                var isGeneratedTemp = string.IsNullOrWhiteSpace(req.AdminUser.Password);
                var tempPassword = isGeneratedTemp
                    ? backend.Helpers.PasswordHasher.GenerateTemporaryPassword()
                    : req.AdminUser.Password!.Trim();

                var adminUser = new User
                {
                    Name = req.AdminUser.Name.Trim(),
                    Email = req.AdminUser.Email.Trim().ToLowerInvariant(),
                    Phone = req.AdminUser.Phone?.Trim() ?? string.Empty,
                    PasswordHash = backend.Helpers.PasswordHasher.HashPassword(tempPassword),
                    RoleId = adminRole.Id,
                    CompanyId = tenant.Id,
                    Status = UserStatus.Active,
                    MustChangePassword = true,
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

    /// <summary>
    /// Generates an authenticated impersonation session for the Super Admin to log into a tenant workspace.
    /// Strictly restricted to Super Admin and audited in immutable platform logs.
    /// </summary>
    [HttpPost("{id}/impersonate")]
    public async Task<ActionResult<ApiResponse<ImpersonateTenantResponseDto>>> ImpersonateTenant(string id, CancellationToken ct = default)
    {
        var tenant = await FindTenantAsync(id, ct);
        if (tenant == null)
            return NotFound(ApiResponse<ImpersonateTenantResponseDto>.FailureResult("Tenant organization not found."));

        if (!tenant.IsActive && tenant.Status?.ToLowerInvariant() == "suspended")
            return BadRequest(ApiResponse<ImpersonateTenantResponseDto>.FailureResult($"Tenant '{tenant.Name}' is suspended. Please activate the organization first before impersonating."));

        // Find primary company_admin or admin user for this tenant
        var targetUser = await _context.Users
            .Include(u => u.Role)
            .Include(u => u.Company)
            .Where(u => u.CompanyId == tenant.Id && (u.Role.Code == "company_admin" || u.Role.Code == "admin"))
            .OrderByDescending(u => u.Status == UserStatus.Active)
            .ThenBy(u => u.Id)
            .FirstOrDefaultAsync(ct);

        // Fallback: any active user in this tenant
        if (targetUser == null)
        {
            targetUser = await _context.Users
                .Include(u => u.Role)
                .Include(u => u.Company)
                .Where(u => u.CompanyId == tenant.Id)
                .OrderByDescending(u => u.Status == UserStatus.Active)
                .ThenBy(u => u.Id)
                .FirstOrDefaultAsync(ct);
        }

        if (targetUser == null)
        {
            return NotFound(ApiResponse<ImpersonateTenantResponseDto>.FailureResult(
                $"No user accounts exist in organization '{tenant.Name}'. Please provision a Company Admin before logging in as this tenant."));
        }

        var token = _jwtService.GenerateToken(targetUser);
        var actorEmail = _currentUser.Email ?? "Super Admin";

        // Immutable Audit Log entry
        _context.AuditLogs.Add(new AuditLog
        {
            Action = "IMPERSONATE_TENANT",
            EntityType = "Tenant",
            EntityId = tenant.Id.ToString(),
            ActorName = actorEmail,
            ActorEmail = actorEmail,
            Details = $"Super Admin initiated impersonation session for tenant '{tenant.Name}' (ID: {tenant.Id}) as user '{targetUser.Name}' ({targetUser.Email}, Role: {targetUser.Role.Code}).",
            Module = "Companies",
            Status = "success",
            Timestamp = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(ct);

        var userDto = new backend.DTOs.Auth.UserDto
        {
            Id = targetUser.Id.ToString(),
            Name = targetUser.Name,
            Email = targetUser.Email,
            Phone = targetUser.Phone,
            Status = targetUser.Status.ToString(),
            CompanyId = tenant.Id.ToString(),
            CompanySlug = tenant.Slug,
            CompanyName = tenant.Name,
            LastLogin = targetUser.LastLoginAt?.ToString("o"),
            Avatar = targetUser.AvatarUrl,
            MustChangePassword = targetUser.MustChangePassword,
            Role = new backend.DTOs.Auth.RoleDto
            {
                Id = targetUser.Role.Id.ToString(),
                Name = targetUser.Role.Name,
                Code = targetUser.Role.Code,
                Permissions = targetUser.Role.Permissions ?? new List<string>()
            }
        };

        var tenantDto = new backend.DTOs.Auth.TenantDto
        {
            Id = tenant.Id.ToString(),
            Name = tenant.Name,
            Slug = tenant.Slug,
            BrandColor = tenant.BrandColor,
            Logo = tenant.Logo,
            Tagline = tenant.Tagline,
            EnabledFeatures = tenant.EnabledFeatures ?? new List<string>(),
            Timezone = tenant.Timezone,
            Currency = tenant.Currency,
            BusinessHours = tenant.BusinessHours
        };

        var responseDto = new ImpersonateTenantResponseDto
        {
            Token = token,
            User = userDto,
            Tenant = tenantDto,
            OriginalAdminEmail = actorEmail,
            IsImpersonated = true,
            TargetRoute = "/dashboard"
        };

        return Ok(ApiResponse<ImpersonateTenantResponseDto>.SuccessResult(responseDto, $"Impersonation session established for {tenant.Name}."));
    }

    /// <summary>
    /// Generates and streams a comprehensive, encrypted-ready compliance zip bundle for a tenant.
    /// Bundles formatted CSV tables of leads, customers, calls, deals, followups, KYC records, and audit logs.
    /// </summary>
    [HttpGet("{id}/compliance-export")]
    public async Task<IActionResult> GetComplianceExport(string id, CancellationToken ct = default)
    {
        var tenant = await FindTenantAsync(id, ct);
        if (tenant == null)
            return NotFound(ApiResponse<bool>.FailureResult("Tenant organization not found."));

        var actorEmail = _currentUser.Email ?? "Super Admin";

        var leads = await _context.Leads.AsNoTracking().Where(l => l.CompanyId == tenant.Id).ToListAsync(ct);
        var customers = await _context.Customers.AsNoTracking().Where(c => c.CompanyId == tenant.Id).ToListAsync(ct);
        var calls = await _context.CallRecords.AsNoTracking().Where(c => c.CompanyId == tenant.Id).ToListAsync(ct);
        var followups = await _context.Followups.AsNoTracking().Where(f => f.CompanyId == tenant.Id).ToListAsync(ct);
        var deals = await _context.GhlDeals.AsNoTracking().Where(d => d.CompanyId == tenant.Id).ToListAsync(ct);
        var kycRecords = await _context.InvestorKycs.AsNoTracking().Where(k => k.CompanyId == tenant.Id).ToListAsync(ct);
        var auditLogs = await _context.AuditLogs.AsNoTracking().Where(a => a.CompanyId == tenant.Id).Take(1000).ToListAsync(ct);

        using var memoryStream = new MemoryStream();
        using (var archive = new ZipArchive(memoryStream, ZipArchiveMode.Create, true))
        {
            // 1. Company Profile JSON
            var summaryJson = JsonSerializer.Serialize(new
            {
                tenant.Id,
                tenant.Name,
                tenant.LegalName,
                tenant.Slug,
                tenant.Industry,
                tenant.SubscriptionPlan,
                tenant.Status,
                tenant.CreatedAt,
                ExportedAt = DateTime.UtcNow,
                ExportedBy = actorEmail,
                SummaryCounts = new
                {
                    TotalLeads = leads.Count,
                    TotalCustomers = customers.Count,
                    TotalCalls = calls.Count,
                    TotalFollowups = followups.Count,
                    TotalDeals = deals.Count,
                    TotalKycRecords = kycRecords.Count,
                    TotalAuditEvents = auditLogs.Count
                }
            }, new JsonSerializerOptions { WriteIndented = true });
            AddZipFile(archive, "company_summary.json", summaryJson);

            // 2. Leads CSV
            var leadsSb = new StringBuilder();
            leadsSb.AppendLine("Id,Name,Email,Phone,Source,Status,CreatedDate");
            foreach (var l in leads)
            {
                leadsSb.AppendLine($"{l.Id},\"{EscapeCsv(l.Name)}\",\"{EscapeCsv(l.Email)}\",\"{EscapeCsv(l.Phone)}\",\"{EscapeCsv(l.Source)}\",\"{EscapeCsv(l.Status.ToString())}\",\"{l.CreatedAt:o}\"");
            }
            AddZipFile(archive, "leads.csv", leadsSb.ToString());

            // 3. Customers CSV
            var custSb = new StringBuilder();
            custSb.AppendLine("Id,Name,Email,Phone,Location,Status,TotalValue,CreatedDate");
            foreach (var c in customers)
            {
                custSb.AppendLine($"{c.Id},\"{EscapeCsv(c.Name)}\",\"{EscapeCsv(c.Email)}\",\"{EscapeCsv(c.Phone)}\",\"{EscapeCsv(c.Location)}\",\"{EscapeCsv(c.Status)}\",{c.TotalValue},\"{c.CreatedAt:o}\"");
            }
            AddZipFile(archive, "customers.csv", custSb.ToString());

            // 4. Calls CSV
            var callsSb = new StringBuilder();
            callsSb.AppendLine("Id,ContactName,ContactPhone,Direction,DurationSeconds,Disposition,RecordingUrl,CreatedDate");
            foreach (var cl in calls)
            {
                callsSb.AppendLine($"{cl.Id},\"{EscapeCsv(cl.ContactName)}\",\"{EscapeCsv(cl.ContactPhone)}\",\"{EscapeCsv(cl.Direction)}\",{cl.Duration},\"{EscapeCsv(cl.Disposition)}\",\"{EscapeCsv(cl.RecordingUrl)}\",\"{cl.CreatedAt:o}\"");
            }
            AddZipFile(archive, "call_records.csv", callsSb.ToString());

            // 5. Followups CSV
            var followupsSb = new StringBuilder();
            followupsSb.AppendLine("Id,LeadId,ScheduledAt,Status,Notes,CreatedAt");
            foreach (var f in followups)
            {
                followupsSb.AppendLine($"{f.Id},{f.LeadId},\"{f.ScheduledAt:o}\",\"{EscapeCsv(f.Status.ToString())}\",\"{EscapeCsv(f.Notes)}\",\"{f.CreatedAt:o}\"");
            }
            AddZipFile(archive, "followups.csv", followupsSb.ToString());

            // 6. Deals CSV
            var dealsSb = new StringBuilder();
            dealsSb.AppendLine("Id,Title,Value,Stage,ExpectedCloseDate,CreatedDate");
            foreach (var d in deals)
            {
                dealsSb.AppendLine($"{d.Id},\"{EscapeCsv(d.Title)}\",{d.Value},\"{EscapeCsv(d.Stage)}\",\"{EscapeCsv(d.ExpectedCloseDate)}\",\"{d.CreatedAt:o}\"");
            }
            AddZipFile(archive, "deals.csv", dealsSb.ToString());

            // 7. KYC Records CSV
            var kycSb = new StringBuilder();
            kycSb.AppendLine("Id,InvestorName,PanNumber,Status,VerifiedAt,CreatedAt");
            foreach (var k in kycRecords)
            {
                kycSb.AppendLine($"{k.Id},\"{EscapeCsv(k.InvestorName)}\",\"{EscapeCsv(k.PanNumber)}\",\"{EscapeCsv(k.Status.ToString())}\",\"{k.VerifiedAt:o}\",\"{k.CreatedAt:o}\"");
            }
            AddZipFile(archive, "kyc_records.csv", kycSb.ToString());

            // 8. Audit Trail CSV
            var auditSb = new StringBuilder();
            auditSb.AppendLine("Id,Action,Module,ActorName,ActorEmail,Details,Timestamp");
            foreach (var a in auditLogs)
            {
                auditSb.AppendLine($"{a.Id},\"{EscapeCsv(a.Action)}\",\"{EscapeCsv(a.Module)}\",\"{EscapeCsv(a.ActorName)}\",\"{EscapeCsv(a.ActorEmail)}\",\"{EscapeCsv(a.Details)}\",\"{a.Timestamp:o}\"");
            }
            AddZipFile(archive, "audit_trail.csv", auditSb.ToString());
        }

        _context.AuditLogs.Add(new AuditLog
        {
            Action = "EXPORT_TENANT_DATA",
            EntityType = "Tenant",
            EntityId = tenant.Id.ToString(),
            CompanyId = tenant.Id,
            ActorName = actorEmail,
            ActorEmail = actorEmail,
            Details = $"Super Admin downloaded full compliance zip archive bundle for tenant '{tenant.Name}'.",
            Module = "Companies",
            Status = "success",
            Timestamp = DateTime.UtcNow
        });
        await _context.SaveChangesAsync(ct);

        var zipBytes = memoryStream.ToArray();
        var filename = $"{tenant.Slug}_compliance_pack_{DateTime.UtcNow:yyyyMMdd_HHmm}.zip";
        return File(zipBytes, "application/zip", filename);
    }

    private static void AddZipFile(ZipArchive archive, string entryName, string content)
    {
        var entry = archive.CreateEntry(entryName, CompressionLevel.Optimal);
        using var writer = new StreamWriter(entry.Open(), Encoding.UTF8);
        writer.Write(content);
    }

    private static string EscapeCsv(string? val)
    {
        if (string.IsNullOrEmpty(val)) return string.Empty;
        return val.Replace("\"", "\"\"").Replace("\r", " ").Replace("\n", " ");
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
