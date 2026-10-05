using backend.Authentication.Interfaces;
using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.SuperAdmin;
using backend.Models.Entities;
using backend.Models.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers.SuperAdmin;

[ApiController]
[Authorize(Roles = "super_admin")]
[Route("api/super-admin/tenants")]
public class PlatformTenantsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public PlatformTenantsController(ApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    [HttpGet]
    [HttpGet("~/api/platform/tenants")]
    public async Task<ActionResult<ApiResponse<List<TenantResponseDto>>>> GetAllTenants(CancellationToken ct = default)
    {
        var tenants = await _context.Tenants
            .AsNoTracking()
            .OrderBy(t => t.Id)
            .ToListAsync(ct);

        var dtos = tenants.Select(MapToResponseDto).ToList();
        return Ok(ApiResponse<List<TenantResponseDto>>.SuccessResult(dtos));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<TenantResponseDto>>> GetTenantById(string id, CancellationToken ct = default)
    {
        var tenant = await FindTenantAsync(id, ct);
        if (tenant == null)
            return NotFound(ApiResponse<TenantResponseDto>.FailureResult("Tenant organization not found."));

        return Ok(ApiResponse<TenantResponseDto>.SuccessResult(MapToResponseDto(tenant)));
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
            var email = req.AdminUser.Email.Trim().ToLowerInvariant();
            var emailExists = await _context.Users.AnyAsync(u => u.Email.ToLower() == email, ct);
            if (!emailExists)
            {
                var companyAdminRole = await _context.Roles.FirstOrDefaultAsync(r => r.Code == "company_admin", ct);
                var rawPassword = string.IsNullOrWhiteSpace(req.AdminUser.Password) ? "Password@123" : req.AdminUser.Password;
                var passwordHash = BCrypt.Net.BCrypt.HashPassword(rawPassword);

                var adminUser = new User
                {
                    Name = string.IsNullOrWhiteSpace(req.AdminUser.Name) ? "Primary Admin" : req.AdminUser.Name.Trim(),
                    Email = email,
                    Phone = req.AdminUser.Phone ?? "+91 98000 00000",
                    PasswordHash = passwordHash,
                    RoleId = companyAdminRole?.Id ?? 2,
                    CompanyId = tenant.Id,
                    Status = UserStatus.Active,
                    CreatedAt = DateTime.UtcNow
                };
                _context.Users.Add(adminUser);
            }
        }

        // Optional provision of DID mapping
        if (req.DidData != null && !string.IsNullOrWhiteSpace(req.DidData.PhoneNumber))
        {
            var didPhone = req.DidData.PhoneNumber.Trim();
            var didExists = await _context.TenantDidMappings.AnyAsync(d => d.PhoneNumber == didPhone, ct);
            if (!didExists)
            {
                var did = new TenantDidMapping
                {
                    TenantId = tenant.Id,
                    PhoneNumber = didPhone,
                    RoutingStrategy = req.DidData.RoutingStrategy ?? "Round-Robin",
                    QueueName = $"{tenant.Name} Inbound",
                    EnableRecording = true,
                    EnableAiWhisper = true,
                    Status = "Online",
                    ChannelsCount = 6,
                    AllocatedAt = DateTime.UtcNow,
                    CreatedAt = DateTime.UtcNow
                };
                _context.TenantDidMappings.Add(did);
            }
        }

        // Record Audit Log
        _context.AuditLogs.Add(new AuditLog
        {
            Action = "PROVISION_TENANT",
            EntityType = "Tenant",
            EntityId = tenant.Id.ToString(),
            CompanyId = tenant.Id,
            ActorName = _currentUser.Email ?? "Super Admin",
            ActorEmail = _currentUser.Email ?? "admin@platform.com",
            Details = $"Super Admin provisioned new tenant organization: \"{tenant.Name}\" ({tenant.Industry}) with {tenant.EnabledFeatures.Count} features.",
            Module = "Companies",
            Status = "success",
            Timestamp = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetTenantById), new { id = tenant.Id }, ApiResponse<TenantResponseDto>.SuccessResult(MapToResponseDto(tenant), "Tenant provisioned successfully."));
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
            var cleanSlug = req.Slug.ToLowerInvariant().Trim();
            if (cleanSlug != tenant.Slug.ToLowerInvariant())
            {
                var exists = await _context.Tenants.AnyAsync(t => t.Slug.ToLower() == cleanSlug && t.Id != tenant.Id, ct);
                if (exists)
                    return BadRequest(ApiResponse<TenantResponseDto>.FailureResult($"Slug '{cleanSlug}' is already taken by another organization."));
                tenant.Slug = cleanSlug;
            }
        }

        if (req.BrandColor != null) tenant.BrandColor = req.BrandColor;
        if (req.Logo != null) tenant.Logo = req.Logo;
        if (req.Tagline != null) tenant.Tagline = req.Tagline.Trim();
        if (req.Industry != null) tenant.Industry = req.Industry.Trim();
        if (req.EnabledFeatures != null) tenant.EnabledFeatures = req.EnabledFeatures;
        if (req.Timezone != null) tenant.Timezone = req.Timezone;
        if (req.Currency != null) tenant.Currency = req.Currency;
        if (req.BusinessHours != null) tenant.BusinessHours = req.BusinessHours;
        if (req.SubscriptionPlan != null) tenant.SubscriptionPlan = req.SubscriptionPlan;
        if (req.LeadSla.HasValue) tenant.LeadSla = req.LeadSla.Value;
        if (req.CallEnabled.HasValue) tenant.CallEnabled = req.CallEnabled.Value;
        if (req.RecordingEnabled.HasValue) tenant.RecordingEnabled = req.RecordingEnabled.Value;
        if (req.TranscriptionEnabled.HasValue) tenant.TranscriptionEnabled = req.TranscriptionEnabled.Value;

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
            Details = $"Super Admin updated organization settings for \"{tenant.Name}\".",
            Module = "Companies",
            Status = "success",
            Timestamp = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(ct);
        return Ok(ApiResponse<TenantResponseDto>.SuccessResult(MapToResponseDto(tenant), "Tenant updated successfully."));
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

        var previousStatus = tenant.Status ?? (tenant.IsActive ? "Active" : "Inactive");
        tenant.Status = req.Status;
        tenant.IsActive = req.Status.Equals("Active", StringComparison.OrdinalIgnoreCase);
        tenant.UpdatedAt = DateTime.UtcNow;

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
        return Ok(ApiResponse<TenantResponseDto>.SuccessResult(MapToResponseDto(tenant), "Status updated successfully."));
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteTenant(string id, CancellationToken ct = default)
    {
        var tenant = await FindTenantAsync(id, ct);
        if (tenant == null)
            return NotFound(ApiResponse<bool>.FailureResult("Tenant organization not found."));

        // Protect primary demonstration tenants
        if (tenant.Id == 1 || tenant.Id == 2)
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
            CreatedAt = t.CreatedAt,
            UpdatedAt = t.UpdatedAt
        };
    }
}
