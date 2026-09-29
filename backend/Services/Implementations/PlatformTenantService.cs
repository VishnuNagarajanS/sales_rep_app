using backend.Authentication.Interfaces;
using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.SuperAdmin;
using backend.Models.Entities;
using backend.Models.Enums;
using backend.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;

namespace backend.Services.Implementations;

public class PlatformTenantService : IPlatformTenantService
{
    private readonly ApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IJwtService _jwtService;

    public PlatformTenantService(ApplicationDbContext db, ICurrentUserService currentUser, IJwtService jwtService)
    {
        _db = db;
        _currentUser = currentUser;
        _jwtService = jwtService;
    }

    public async Task<ApiResponse<List<PlatformTenantDto>>> GetAllTenantsAsync(string? search, string? status, string? industry, CancellationToken ct = default)
    {
        var query = _db.Tenants
            .Include(t => t.Users)
            .AsNoTracking()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(t => t.Status.ToLower() == status.ToLower());
        }

        if (!string.IsNullOrWhiteSpace(industry) && !industry.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(t => t.Industry != null && t.Industry.ToLower().Contains(industry.ToLower()));
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(t =>
                t.Name.ToLower().Contains(s) ||
                t.Slug.ToLower().Contains(s) ||
                (t.LegalName != null && t.LegalName.ToLower().Contains(s)) ||
                (t.Tagline != null && t.Tagline.ToLower().Contains(s)));
        }

        var tenants = await query.OrderBy(t => t.Id).ToListAsync(ct);
        var didCounts = await _db.TenantDidMappings
            .Where(d => d.TenantId != null)
            .GroupBy(d => d.TenantId!.Value)
            .Select(g => new { TenantId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.TenantId, x => x.Count, ct);

        var result = tenants.Select(t => new PlatformTenantDto
        {
            Id = t.Id.ToString(),
            Name = t.Name,
            Slug = t.Slug,
            LegalName = t.LegalName,
            Industry = t.Industry,
            BrandColor = t.BrandColor,
            Logo = t.Logo,
            Tagline = t.Tagline,
            EnabledFeatures = t.EnabledFeatures ?? new List<string>(),
            Timezone = t.Timezone,
            Currency = t.Currency,
            BusinessHours = t.BusinessHours,
            Status = t.Status ?? (t.IsActive ? "Active" : "Inactive"),
            SubscriptionPlan = t.SubscriptionPlan ?? "Starter CRM Tier",
            LeadSla = t.LeadSla,
            CallEnabled = t.CallEnabled,
            RecordingEnabled = t.RecordingEnabled,
            TranscriptionEnabled = t.TranscriptionEnabled,
            UsersCount = t.Users?.Count ?? 0,
            ActiveUsersCount = t.Users?.Count(u => u.Status == UserStatus.Active) ?? 0,
            DidsCount = didCounts.TryGetValue(t.Id, out var count) ? count : 0,
            CreatedAt = t.CreatedAt.ToString("o"),
            UpdatedAt = t.UpdatedAt?.ToString("o")
        }).ToList();

        return ApiResponse<List<PlatformTenantDto>>.SuccessResult(result);
    }

    public async Task<ApiResponse<PlatformTenantDetailDto>> GetTenantByIdAsync(int id, CancellationToken ct = default)
    {
        var t = await _db.Tenants
            .Include(t => t.Users)
                .ThenInclude(u => u.Role)
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == id, ct);

        if (t == null)
            return ApiResponse<PlatformTenantDetailDto>.FailureResult($"Tenant with ID {id} not found.");

        var dids = await _db.TenantDidMappings
            .Where(d => d.TenantId == id)
            .AsNoTracking()
            .ToListAsync(ct);

        var dto = new PlatformTenantDetailDto
        {
            Id = t.Id.ToString(),
            Name = t.Name,
            Slug = t.Slug,
            LegalName = t.LegalName,
            Industry = t.Industry,
            BrandColor = t.BrandColor,
            Logo = t.Logo,
            Tagline = t.Tagline,
            EnabledFeatures = t.EnabledFeatures ?? new List<string>(),
            Timezone = t.Timezone,
            Currency = t.Currency,
            BusinessHours = t.BusinessHours,
            Status = t.Status ?? (t.IsActive ? "Active" : "Inactive"),
            SubscriptionPlan = t.SubscriptionPlan ?? "Starter CRM Tier",
            LeadSla = t.LeadSla,
            CallEnabled = t.CallEnabled,
            RecordingEnabled = t.RecordingEnabled,
            TranscriptionEnabled = t.TranscriptionEnabled,
            UsersCount = t.Users?.Count ?? 0,
            ActiveUsersCount = t.Users?.Count(u => u.Status == UserStatus.Active) ?? 0,
            DidsCount = dids.Count,
            CreatedAt = t.CreatedAt.ToString("o"),
            UpdatedAt = t.UpdatedAt?.ToString("o"),
            Users = (t.Users ?? new List<User>()).Select(u => new PlatformUserDto
            {
                Id = u.Id.ToString(),
                Name = u.Name,
                Email = u.Email,
                Phone = u.Phone,
                CompanyId = t.Id.ToString(),
                CompanyName = t.Name,
                CompanySlug = t.Slug,
                Role = new PlatformRoleDto
                {
                    Id = u.Role.Id.ToString(),
                    Name = u.Role.Name,
                    Code = u.Role.Code,
                    Permissions = u.Role.Permissions ?? new List<string>()
                },
                Status = u.Status.ToString(),
                LastLogin = u.LastLoginAt.HasValue ? u.LastLoginAt.Value.ToString("yyyy-MM-dd HH:mm:ss") : "Never",
                CreatedAt = u.CreatedAt.ToString("o")
            }).ToList(),
            Dids = dids.Select(d => new TenantDidMappingDto
            {
                Id = d.Id.ToString(),
                PhoneNumber = d.PhoneNumber,
                TenantId = t.Id.ToString(),
                TenantName = t.Name,
                TenantSlug = t.Slug,
                RoutingStrategy = d.RoutingStrategy,
                QueueName = d.QueueName,
                EnableRecording = d.EnableRecording,
                EnableAiWhisper = d.EnableAiWhisper,
                Status = d.Status,
                ChannelsCount = d.ChannelsCount,
                AllocatedAt = d.AllocatedAt.ToString("o"),
                Notes = d.Notes
            }).ToList()
        };

        return ApiResponse<PlatformTenantDetailDto>.SuccessResult(dto);
    }

    public async Task<ApiResponse<PlatformTenantDto>> CreateTenantWizardAsync(CreateTenantWizardDto dto, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return ApiResponse<PlatformTenantDto>.FailureResult("Organization Name is required.");

        var cleanSlug = (string.IsNullOrWhiteSpace(dto.Slug) ? dto.Name : dto.Slug)
            .Trim()
            .ToLowerInvariant();
        cleanSlug = Regex.Replace(cleanSlug, @"[^a-z0-9]", "");
        if (string.IsNullOrWhiteSpace(cleanSlug))
            cleanSlug = $"tenant{DateTime.UtcNow.Ticks % 10000}";

        var slugExists = await _db.Tenants.AnyAsync(t => t.Slug == cleanSlug, ct);
        if (slugExists)
            cleanSlug = $"{cleanSlug}{new Random().Next(10, 99)}";

        var newTenant = new Tenant
        {
            Name = dto.Name.Trim(),
            Slug = cleanSlug,
            LegalName = dto.LegalName?.Trim() ?? dto.Name.Trim(),
            Industry = dto.Industry?.Trim() ?? "Commercial Real Estate",
            Tagline = dto.Tagline?.Trim() ?? "Enterprise Organization",
            BrandColor = dto.BrandColor?.Trim() ?? "#8b5cf6",
            Timezone = dto.Timezone?.Trim() ?? "Asia/Kolkata (IST)",
            Currency = dto.Currency?.Trim() ?? "₹ INR",
            BusinessHours = dto.BusinessHours?.Trim() ?? "09:30 AM - 06:30 PM IST",
            SubscriptionPlan = dto.SubscriptionPlan ?? "Wealth Advisory Enterprise Suite",
            EnabledFeatures = dto.EnabledFeatures != null && dto.EnabledFeatures.Count > 0
                ? dto.EnabledFeatures
                : new List<string> { "leads", "customers", "deals", "calls", "reports" },
            Status = "Active",
            IsActive = true,
            LeadSla = 15,
            CallEnabled = true,
            RecordingEnabled = true,
            TranscriptionEnabled = true,
            CreatedAt = DateTime.UtcNow
        };

        _db.Tenants.Add(newTenant);
        await _db.SaveChangesAsync(ct);

        // Step 3: Provision primary Company Admin user if details provided
        if (!string.IsNullOrWhiteSpace(dto.AdminEmail))
        {
            var adminRole = await _db.Roles.FirstOrDefaultAsync(r => r.Code == "company_admin", ct);
            if (adminRole != null)
            {
                var initialPassword = string.IsNullOrWhiteSpace(dto.AdminPassword) ? "Password@123" : dto.AdminPassword;
                var newUser = new User
                {
                    Name = dto.AdminName?.Trim() ?? $"{newTenant.Name} Admin",
                    Email = dto.AdminEmail.Trim().ToLowerInvariant(),
                    Phone = dto.AdminPhone?.Trim() ?? string.Empty,
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(initialPassword),
                    RoleId = adminRole.Id,
                    CompanyId = newTenant.Id,
                    Status = UserStatus.Active,
                    CreatedAt = DateTime.UtcNow
                };
                _db.Users.Add(newUser);
            }
        }

        // Step 4: Provision or allocate DID if provided
        if (!string.IsNullOrWhiteSpace(dto.DidPhoneNumber))
        {
            var did = new TenantDidMapping
            {
                PhoneNumber = dto.DidPhoneNumber.Trim(),
                TenantId = newTenant.Id,
                RoutingStrategy = dto.DidRoutingStrategy?.Trim() ?? "Round-Robin",
                QueueName = dto.DidQueueName?.Trim() ?? "Inbound Sales Queue",
                EnableRecording = true,
                EnableAiWhisper = true,
                Status = "Online",
                ChannelsCount = 8,
                AllocatedAt = DateTime.UtcNow,
                Notes = $"Allocated via onboarding wizard for {newTenant.Name}"
            };
            _db.TenantDidMappings.Add(did);
        }

        // Log audit event
        _db.AuditLogs.Add(new AuditLog
        {
            CompanyId = newTenant.Id,
            Timestamp = DateTime.UtcNow,
            ActorName = "Super Admin",
            ActorEmail = _currentUser.Email ?? "yanosh@ghlindiaventures.com",
            Action = "PROVISION_TENANT",
            EntityType = "Tenant",
            EntityId = newTenant.Id.ToString(),
            Details = $"Super Admin onboarded organization '{newTenant.Name}' (Slug: {newTenant.Slug}) with plan '{newTenant.SubscriptionPlan}'.",
            Module = "Companies",
            Status = "success"
        });

        await _db.SaveChangesAsync(ct);

        var resultDto = new PlatformTenantDto
        {
            Id = newTenant.Id.ToString(),
            Name = newTenant.Name,
            Slug = newTenant.Slug,
            LegalName = newTenant.LegalName,
            Industry = newTenant.Industry,
            BrandColor = newTenant.BrandColor,
            Tagline = newTenant.Tagline,
            EnabledFeatures = newTenant.EnabledFeatures,
            Timezone = newTenant.Timezone,
            Currency = newTenant.Currency,
            BusinessHours = newTenant.BusinessHours,
            Status = newTenant.Status,
            SubscriptionPlan = newTenant.SubscriptionPlan,
            LeadSla = newTenant.LeadSla,
            CallEnabled = newTenant.CallEnabled,
            RecordingEnabled = newTenant.RecordingEnabled,
            TranscriptionEnabled = newTenant.TranscriptionEnabled,
            UsersCount = 1,
            ActiveUsersCount = 1,
            DidsCount = string.IsNullOrWhiteSpace(dto.DidPhoneNumber) ? 0 : 1,
            CreatedAt = newTenant.CreatedAt.ToString("o")
        };

        return ApiResponse<PlatformTenantDto>.SuccessResult(resultDto, "Organization provisioned successfully.");
    }

    public async Task<ApiResponse<PlatformTenantDto>> UpdateTenantAsync(int id, UpdateTenantDto dto, CancellationToken ct = default)
    {
        var tenant = await _db.Tenants.FirstOrDefaultAsync(t => t.Id == id, ct);
        if (tenant == null)
            return ApiResponse<PlatformTenantDto>.FailureResult($"Tenant with ID {id} not found.");

        if (!string.IsNullOrWhiteSpace(dto.Name)) tenant.Name = dto.Name.Trim();
        if (dto.LegalName != null) tenant.LegalName = dto.LegalName.Trim();
        if (dto.Industry != null) tenant.Industry = dto.Industry.Trim();
        if (dto.BrandColor != null) tenant.BrandColor = dto.BrandColor.Trim();
        if (dto.Logo != null) tenant.Logo = dto.Logo.Trim();
        if (dto.Tagline != null) tenant.Tagline = dto.Tagline.Trim();
        if (dto.Timezone != null) tenant.Timezone = dto.Timezone.Trim();
        if (dto.Currency != null) tenant.Currency = dto.Currency.Trim();
        if (dto.BusinessHours != null) tenant.BusinessHours = dto.BusinessHours.Trim();
        if (dto.SubscriptionPlan != null) tenant.SubscriptionPlan = dto.SubscriptionPlan.Trim();
        if (dto.LeadSla.HasValue) tenant.LeadSla = dto.LeadSla.Value;
        if (dto.CallEnabled.HasValue) tenant.CallEnabled = dto.CallEnabled.Value;
        if (dto.RecordingEnabled.HasValue) tenant.RecordingEnabled = dto.RecordingEnabled.Value;
        if (dto.TranscriptionEnabled.HasValue) tenant.TranscriptionEnabled = dto.TranscriptionEnabled.Value;
        if (!string.IsNullOrWhiteSpace(dto.Status))
        {
            tenant.Status = dto.Status.Trim();
            tenant.IsActive = tenant.Status.Equals("Active", StringComparison.OrdinalIgnoreCase);
        }

        tenant.UpdatedAt = DateTime.UtcNow;

        _db.AuditLogs.Add(new AuditLog
        {
            CompanyId = tenant.Id,
            Timestamp = DateTime.UtcNow,
            ActorName = "Super Admin",
            ActorEmail = _currentUser.Email ?? "yanosh@ghlindiaventures.com",
            Action = "UPDATE_TENANT",
            EntityType = "Tenant",
            EntityId = tenant.Id.ToString(),
            Details = $"Super Admin updated settings for company '{tenant.Name}'.",
            Module = "Companies",
            Status = "success"
        });

        await _db.SaveChangesAsync(ct);

        var userCount = await _db.Users.CountAsync(u => u.CompanyId == tenant.Id, ct);
        var didCount = await _db.TenantDidMappings.CountAsync(d => d.TenantId == tenant.Id, ct);

        var resultDto = new PlatformTenantDto
        {
            Id = tenant.Id.ToString(),
            Name = tenant.Name,
            Slug = tenant.Slug,
            LegalName = tenant.LegalName,
            Industry = tenant.Industry,
            BrandColor = tenant.BrandColor,
            Logo = tenant.Logo,
            Tagline = tenant.Tagline,
            EnabledFeatures = tenant.EnabledFeatures,
            Timezone = tenant.Timezone,
            Currency = tenant.Currency,
            BusinessHours = tenant.BusinessHours,
            Status = tenant.Status,
            SubscriptionPlan = tenant.SubscriptionPlan,
            LeadSla = tenant.LeadSla,
            CallEnabled = tenant.CallEnabled,
            RecordingEnabled = tenant.RecordingEnabled,
            TranscriptionEnabled = tenant.TranscriptionEnabled,
            UsersCount = userCount,
            ActiveUsersCount = userCount,
            DidsCount = didCount,
            CreatedAt = tenant.CreatedAt.ToString("o"),
            UpdatedAt = tenant.UpdatedAt?.ToString("o")
        };

        return ApiResponse<PlatformTenantDto>.SuccessResult(resultDto, "Organization updated successfully.");
    }

    public async Task<ApiResponse<bool>> UpdateTenantStatusAsync(int id, string status, CancellationToken ct = default)
    {
        var tenant = await _db.Tenants.FirstOrDefaultAsync(t => t.Id == id, ct);
        if (tenant == null)
            return ApiResponse<bool>.FailureResult($"Tenant with ID {id} not found.");

        tenant.Status = status;
        tenant.IsActive = status.Equals("Active", StringComparison.OrdinalIgnoreCase);
        tenant.UpdatedAt = DateTime.UtcNow;

        _db.AuditLogs.Add(new AuditLog
        {
            CompanyId = tenant.Id,
            Timestamp = DateTime.UtcNow,
            ActorName = "Super Admin",
            ActorEmail = _currentUser.Email ?? "yanosh@ghlindiaventures.com",
            Action = "UPDATE_TENANT_STATUS",
            EntityType = "Tenant",
            EntityId = tenant.Id.ToString(),
            Details = $"Super Admin changed company '{tenant.Name}' status to '{status}'.",
            Module = "Companies",
            Status = "success"
        });

        await _db.SaveChangesAsync(ct);
        return ApiResponse<bool>.SuccessResult(true, $"Organization status set to {status}.");
    }

    public async Task<ApiResponse<List<string>>> UpdateTenantFeaturesAsync(int id, List<string> features, CancellationToken ct = default)
    {
        var tenant = await _db.Tenants.FirstOrDefaultAsync(t => t.Id == id, ct);
        if (tenant == null)
            return ApiResponse<List<string>>.FailureResult($"Tenant with ID {id} not found.");

        tenant.EnabledFeatures = features ?? new List<string>();
        tenant.UpdatedAt = DateTime.UtcNow;

        _db.AuditLogs.Add(new AuditLog
        {
            CompanyId = tenant.Id,
            Timestamp = DateTime.UtcNow,
            ActorName = "Super Admin",
            ActorEmail = _currentUser.Email ?? "yanosh@ghlindiaventures.com",
            Action = "UPDATE_FEATURE_FLAGS",
            EntityType = "Tenant",
            EntityId = tenant.Id.ToString(),
            Details = $"Super Admin updated enabled features for '{tenant.Name}'. Total active: {tenant.EnabledFeatures.Count}.",
            Module = "Features",
            Status = "success"
        });

        await _db.SaveChangesAsync(ct);
        return ApiResponse<List<string>>.SuccessResult(tenant.EnabledFeatures, "Features updated successfully.");
    }

    public async Task<ApiResponse<bool>> DeleteTenantAsync(int id, CancellationToken ct = default)
    {
        var tenant = await _db.Tenants.FirstOrDefaultAsync(t => t.Id == id, ct);
        if (tenant == null)
            return ApiResponse<bool>.FailureResult($"Tenant with ID {id} not found.");

        if (tenant.Id == 1 || tenant.Id == 2)
        {
            // Seed tenants protected from hard deletion, can set to suspended
            tenant.Status = "Suspended";
            tenant.IsActive = false;
            tenant.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
            return ApiResponse<bool>.SuccessResult(true, "Core demo tenant suspended (cannot be purged).");
        }

        _db.Tenants.Remove(tenant);

        _db.AuditLogs.Add(new AuditLog
        {
            CompanyId = null,
            Timestamp = DateTime.UtcNow,
            ActorName = "Super Admin",
            ActorEmail = _currentUser.Email ?? "yanosh@ghlindiaventures.com",
            Action = "DELETE_TENANT",
            EntityType = "Tenant",
            EntityId = id.ToString(),
            Details = $"Super Admin removed company '{tenant.Name}' (ID: {id}).",
            Module = "Companies",
            Status = "success"
        });

        await _db.SaveChangesAsync(ct);
        return ApiResponse<bool>.SuccessResult(true, "Organization deleted successfully.");
    }

    public async Task<ApiResponse<object>> ImpersonateTenantAsync(int id, CancellationToken ct = default)
    {
        var tenant = await _db.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id, ct);
        if (tenant == null)
            return ApiResponse<object>.FailureResult($"Tenant with ID {id} not found.");

        var superAdminUser = await _db.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.Id == 1, ct);
        if (superAdminUser == null)
            return ApiResponse<object>.FailureResult("Super Admin user not found.");

        // Generate token with tenant context
        var tempUser = new User
        {
            Id = superAdminUser.Id,
            Name = superAdminUser.Name,
            Email = superAdminUser.Email,
            RoleId = superAdminUser.RoleId,
            Role = superAdminUser.Role,
            CompanyId = tenant.Id,
            Company = tenant
        };

        var token = _jwtService.GenerateToken(tempUser);

        _db.AuditLogs.Add(new AuditLog
        {
            CompanyId = tenant.Id,
            Timestamp = DateTime.UtcNow,
            ActorName = "Super Admin",
            ActorEmail = _currentUser.Email ?? "yanosh@ghlindiaventures.com",
            Action = "IMPERSONATE_INSPECT",
            EntityType = "Tenant",
            EntityId = tenant.Id.ToString(),
            Details = $"Super Admin launched support inspection view for '{tenant.Name}'.",
            Module = "Companies",
            Status = "success"
        });
        await _db.SaveChangesAsync(ct);

        return ApiResponse<object>.SuccessResult(new
        {
            token,
            tenantId = tenant.Id.ToString(),
            tenantName = tenant.Name,
            tenantSlug = tenant.Slug,
            brandColor = tenant.BrandColor,
            features = tenant.EnabledFeatures
        }, "Support inspection token generated.");
    }
}
