using backend.Authentication.Interfaces;
using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.SuperAdmin;
using backend.Models.Entities;
using backend.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Implementations;

public class PlatformPackageService : IPlatformPackageService
{
    private readonly ApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;

    public PlatformPackageService(ApplicationDbContext db, ICurrentUserService currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<ApiResponse<List<SubscriptionPackageDto>>> GetAllPackagesAsync(CancellationToken ct = default)
    {
        var packages = await _db.SubscriptionPackages
            .AsNoTracking()
            .OrderBy(p => p.PriceMonthly)
            .ToListAsync(ct);

        // Get count of tenants per package
        var tenants = await _db.Tenants
            .AsNoTracking()
            .Select(t => t.SubscriptionPlan)
            .ToListAsync(ct);

        var result = packages.Select(p => new SubscriptionPackageDto
        {
            Id = p.Id.ToString(),
            Name = p.Name,
            Code = p.Code,
            Description = p.Description,
            Tier = p.Tier,
            PriceMonthly = p.PriceMonthly,
            Currency = p.Currency,
            MaxUsers = p.MaxUsers,
            MaxStorageGb = p.MaxStorageGb,
            Features = p.Features ?? new List<string>(),
            IsActive = p.IsActive,
            IsPopular = p.IsPopular,
            EnrolledTenantsCount = tenants.Count(plan => string.Equals(plan, p.Name, StringComparison.OrdinalIgnoreCase) || string.Equals(plan, p.Code, StringComparison.OrdinalIgnoreCase)),
            CreatedAt = p.CreatedAt.ToString("o")
        }).ToList();

        return ApiResponse<List<SubscriptionPackageDto>>.SuccessResult(result);
    }

    public async Task<ApiResponse<SubscriptionPackageDto>> GetPackageByIdAsync(int id, CancellationToken ct = default)
    {
        var p = await _db.SubscriptionPackages
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id, ct);

        if (p == null)
            return ApiResponse<SubscriptionPackageDto>.FailureResult($"Package with ID {id} not found.");

        var enrolled = await _db.Tenants
            .CountAsync(t => t.SubscriptionPlan == p.Name || t.SubscriptionPlan == p.Code, ct);

        var dto = new SubscriptionPackageDto
        {
            Id = p.Id.ToString(),
            Name = p.Name,
            Code = p.Code,
            Description = p.Description,
            Tier = p.Tier,
            PriceMonthly = p.PriceMonthly,
            Currency = p.Currency,
            MaxUsers = p.MaxUsers,
            MaxStorageGb = p.MaxStorageGb,
            Features = p.Features ?? new List<string>(),
            IsActive = p.IsActive,
            IsPopular = p.IsPopular,
            EnrolledTenantsCount = enrolled,
            CreatedAt = p.CreatedAt.ToString("o")
        };

        return ApiResponse<SubscriptionPackageDto>.SuccessResult(dto);
    }

    public async Task<ApiResponse<SubscriptionPackageDto>> CreatePackageAsync(CreatePackageDto dto, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(dto.Name) || string.IsNullOrWhiteSpace(dto.Code))
            return ApiResponse<SubscriptionPackageDto>.FailureResult("Package Name and Code are required.");

        var existing = await _db.SubscriptionPackages.AnyAsync(p => p.Code == dto.Code.Trim().ToLowerInvariant(), ct);
        if (existing)
            return ApiResponse<SubscriptionPackageDto>.FailureResult($"Package with code '{dto.Code}' already exists.");

        var pkg = new SubscriptionPackage
        {
            Name = dto.Name.Trim(),
            Code = dto.Code.Trim().ToLowerInvariant(),
            Description = dto.Description.Trim(),
            Tier = dto.Tier,
            PriceMonthly = dto.PriceMonthly,
            Currency = dto.Currency,
            MaxUsers = dto.MaxUsers,
            MaxStorageGb = dto.MaxStorageGb,
            Features = dto.Features ?? new List<string>(),
            IsPopular = dto.IsPopular,
            IsActive = dto.IsActive,
            CreatedAt = DateTime.UtcNow
        };

        _db.SubscriptionPackages.Add(pkg);

        _db.AuditLogs.Add(new AuditLog
        {
            CompanyId = null,
            Timestamp = DateTime.UtcNow,
            ActorName = "Super Admin",
            ActorEmail = _currentUser.Email ?? "yanosh@ghlindiaventures.com",
            Action = "CREATE_PACKAGE",
            EntityType = "SubscriptionPackage",
            EntityId = pkg.Code,
            Details = $"Super Admin added subscription package '{pkg.Name}' ({pkg.Tier}) at {pkg.Currency}{pkg.PriceMonthly}/mo.",
            Module = "Features",
            Status = "success"
        });

        await _db.SaveChangesAsync(ct);

        var resultDto = new SubscriptionPackageDto
        {
            Id = pkg.Id.ToString(),
            Name = pkg.Name,
            Code = pkg.Code,
            Description = pkg.Description,
            Tier = pkg.Tier,
            PriceMonthly = pkg.PriceMonthly,
            Currency = pkg.Currency,
            MaxUsers = pkg.MaxUsers,
            MaxStorageGb = pkg.MaxStorageGb,
            Features = pkg.Features,
            IsActive = pkg.IsActive,
            IsPopular = pkg.IsPopular,
            EnrolledTenantsCount = 0,
            CreatedAt = pkg.CreatedAt.ToString("o")
        };

        return ApiResponse<SubscriptionPackageDto>.SuccessResult(resultDto, "Package created successfully.");
    }

    public async Task<ApiResponse<SubscriptionPackageDto>> UpdatePackageAsync(int id, UpdatePackageDto dto, CancellationToken ct = default)
    {
        var pkg = await _db.SubscriptionPackages.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (pkg == null)
            return ApiResponse<SubscriptionPackageDto>.FailureResult($"Package with ID {id} not found.");

        if (!string.IsNullOrWhiteSpace(dto.Name)) pkg.Name = dto.Name.Trim();
        if (dto.Description != null) pkg.Description = dto.Description.Trim();
        if (dto.Tier != null) pkg.Tier = dto.Tier.Trim();
        if (dto.PriceMonthly.HasValue) pkg.PriceMonthly = dto.PriceMonthly.Value;
        if (dto.Currency != null) pkg.Currency = dto.Currency.Trim();
        if (dto.MaxUsers.HasValue) pkg.MaxUsers = dto.MaxUsers.Value;
        if (dto.MaxStorageGb.HasValue) pkg.MaxStorageGb = dto.MaxStorageGb.Value;
        if (dto.Features != null) pkg.Features = dto.Features;
        if (dto.IsPopular.HasValue) pkg.IsPopular = dto.IsPopular.Value;
        if (dto.IsActive.HasValue) pkg.IsActive = dto.IsActive.Value;
        pkg.UpdatedAt = DateTime.UtcNow;

        _db.AuditLogs.Add(new AuditLog
        {
            CompanyId = null,
            Timestamp = DateTime.UtcNow,
            ActorName = "Super Admin",
            ActorEmail = _currentUser.Email ?? "yanosh@ghlindiaventures.com",
            Action = "UPDATE_PACKAGE",
            EntityType = "SubscriptionPackage",
            EntityId = pkg.Id.ToString(),
            Details = $"Super Admin updated package '{pkg.Name}'.",
            Module = "Features",
            Status = "success"
        });

        await _db.SaveChangesAsync(ct);

        var enrolled = await _db.Tenants
            .CountAsync(t => t.SubscriptionPlan == pkg.Name || t.SubscriptionPlan == pkg.Code, ct);

        var resultDto = new SubscriptionPackageDto
        {
            Id = pkg.Id.ToString(),
            Name = pkg.Name,
            Code = pkg.Code,
            Description = pkg.Description,
            Tier = pkg.Tier,
            PriceMonthly = pkg.PriceMonthly,
            Currency = pkg.Currency,
            MaxUsers = pkg.MaxUsers,
            MaxStorageGb = pkg.MaxStorageGb,
            Features = pkg.Features,
            IsActive = pkg.IsActive,
            IsPopular = pkg.IsPopular,
            EnrolledTenantsCount = enrolled,
            CreatedAt = pkg.CreatedAt.ToString("o")
        };

        return ApiResponse<SubscriptionPackageDto>.SuccessResult(resultDto, "Package updated successfully.");
    }

    public async Task<ApiResponse<bool>> DeletePackageAsync(int id, CancellationToken ct = default)
    {
        var pkg = await _db.SubscriptionPackages.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (pkg == null)
            return ApiResponse<bool>.FailureResult($"Package with ID {id} not found.");

        var enrolled = await _db.Tenants
            .AnyAsync(t => t.SubscriptionPlan == pkg.Name || t.SubscriptionPlan == pkg.Code, ct);
        if (enrolled)
            return ApiResponse<bool>.FailureResult("Cannot delete package while enterprise tenants are enrolled. Deactivate instead.");

        _db.SubscriptionPackages.Remove(pkg);

        _db.AuditLogs.Add(new AuditLog
        {
            CompanyId = null,
            Timestamp = DateTime.UtcNow,
            ActorName = "Super Admin",
            ActorEmail = _currentUser.Email ?? "yanosh@ghlindiaventures.com",
            Action = "DELETE_PACKAGE",
            EntityType = "SubscriptionPackage",
            EntityId = id.ToString(),
            Details = $"Super Admin removed subscription package '{pkg.Name}'.",
            Module = "Features",
            Status = "success"
        });

        await _db.SaveChangesAsync(ct);
        return ApiResponse<bool>.SuccessResult(true, "Package removed successfully.");
    }

    public List<FeatureCatalogItemDto> GetFeatureCatalog()
    {
        return new List<FeatureCatalogItemDto>
        {
            new() { Key = "leads", Name = "Inbound Leads Management", Category = "Sales Core", Description = "Custom fields, dynamic lead scoring, stage qualification, CSV bulk import & conversion." },
            new() { Key = "customers", Name = "Customer 360 Records", Category = "Sales Core", Description = "Unified contact timeline, past deals, document vault, and call history." },
            new() { Key = "deals", Name = "Deals & Pipeline Kanban", Category = "Sales Core", Description = "Multi-stage pipeline board with tenant-configured stages and financial values." },
            new() { Key = "followups", Name = "Follow-ups & Reminders", Category = "Sales Core", Description = "Task scheduler with overdue alerting, quick callbacks, and multi-channel reminders." },
            new() { Key = "calls", Name = "Live Call Center Engine", Category = "Telephony", Description = "Embedded WebRTC softphone, live duration timer, objection handling script, and disposition modal." },
            new() { Key = "call-recording", Name = "Voice Call Recordings", Category = "Telephony", Description = "Secure cloud recording storage, audio waveform player, and compliance archival." },
            new() { Key = "call-transcription", Name = "Automated AI Transcripts", Category = "Telephony", Description = "OpenAI Whisper speech-to-text transcript processing for dispute resolution." },
            new() { Key = "properties", Name = "Plotted Layouts & Inventory", Category = "Jamin Real Estate", Description = "Visual plot layout grid, square yardage, pricing tiers, and hold/release actions." },
            new() { Key = "site-visits", Name = "Prospective Buyer Site Visits", Category = "Jamin Real Estate", Description = "Layout tour scheduling, cab & driver allocation, escort tracking, and post-visit survey." },
            new() { Key = "bookings", Name = "Plot Reservation Bookings", Category = "Jamin Real Estate", Description = "Token receipts, advance allotment letters, and automatic inventory status transitions." },
            new() { Key = "investors", Name = "HNW Investors 360", Category = "GHL Wealth Advisory", Description = "Ultra-HNI profiles, committed AUM tracking, capital allocation, and mandate evaluation." },
            new() { Key = "consultations", Name = "Private Advisory Consultations", Category = "GHL Wealth Advisory", Description = "1-on-1 private wealth consultation scheduling, agendas, and investment advisory notes." },
            new() { Key = "investment-opportunities", Name = "Commercial CRE Tranches", Category = "GHL Wealth Advisory", Description = "Commercial pre-leased syndicates, industrial logistics funds, and target yield tracking." },
            new() { Key = "reports", Name = "Analytics & Leaderboards", Category = "Intelligence", Description = "Conversion funnels, agent performance leaderboards, talk-time metrics, and CSV exports." }
        };
    }
}
