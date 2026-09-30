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
[Route("api/super-admin/packages")]
public class PlatformPackagesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public PlatformPackagesController(ApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<PackageResponseDto>>>> GetAllPackages(CancellationToken ct = default)
    {
        var packages = await _context.SubscriptionPackages
            .AsNoTracking()
            .OrderBy(p => p.PriceMonthly)
            .ToListAsync(ct);

        // Calculate enrolled tenants count for each package
        var tenants = await _context.Tenants
            .AsNoTracking()
            .Select(t => new { t.SubscriptionPlan })
            .ToListAsync(ct);

        var dtos = packages.Select(p =>
        {
            var enrolledCount = tenants.Count(t =>
            {
                var plan = string.IsNullOrWhiteSpace(t.SubscriptionPlan) ? "Starter CRM Tier" : t.SubscriptionPlan;
                return plan.Equals(p.Name, StringComparison.OrdinalIgnoreCase) ||
                       plan.Equals(p.Code, StringComparison.OrdinalIgnoreCase);
            });

            return MapToResponseDto(p, enrolledCount);
        }).ToList();

        return Ok(ApiResponse<List<PackageResponseDto>>.SuccessResult(dtos));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<PackageResponseDto>>> GetPackageById(string id, CancellationToken ct = default)
    {
        var pkg = await FindPackageAsync(id, ct);
        if (pkg == null)
            return NotFound(ApiResponse<PackageResponseDto>.FailureResult("Subscription package not found."));

        var enrolledCount = await _context.Tenants
            .CountAsync(t => (t.SubscriptionPlan ?? "Starter CRM Tier") == pkg.Name || (t.SubscriptionPlan ?? "Starter CRM Tier") == pkg.Code, ct);

        return Ok(ApiResponse<PackageResponseDto>.SuccessResult(MapToResponseDto(pkg, enrolledCount)));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<PackageResponseDto>>> CreatePackage(
        [FromBody] CreatePackageRequestDto req,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(req.Name))
            return BadRequest(ApiResponse<PackageResponseDto>.FailureResult("Package name is required."));

        var cleanCode = (string.IsNullOrWhiteSpace(req.Code) ? req.Name : req.Code)
            .ToLowerInvariant()
            .Trim();
        cleanCode = System.Text.RegularExpressions.Regex.Replace(cleanCode, @"[^a-z0-9_]", "_");

        var exists = await _context.SubscriptionPackages.AnyAsync(p => p.Code.ToLower() == cleanCode, ct);
        if (exists)
            return BadRequest(ApiResponse<PackageResponseDto>.FailureResult($"A package tier with code '{cleanCode}' already exists."));

        var pkg = new SubscriptionPackage
        {
            Name = req.Name.Trim(),
            Code = cleanCode,
            Description = req.Description?.Trim() ?? string.Empty,
            Tier = string.IsNullOrWhiteSpace(req.Tier) ? "Growth" : req.Tier.Trim(),
            PriceMonthly = req.PriceMonthly,
            Currency = string.IsNullOrWhiteSpace(req.Currency) ? "₹" : req.Currency.Trim(),
            MaxUsers = req.MaxUsers > 0 ? req.MaxUsers : 25,
            MaxStorageGb = req.MaxStorageGb > 0 ? req.MaxStorageGb : 100,
            Features = req.Features ?? new List<string> { "leads", "customers", "calls" },
            IsPopular = req.IsPopular,
            IsActive = req.IsActive,
            CreatedAt = DateTime.UtcNow
        };

        _context.SubscriptionPackages.Add(pkg);

        _context.AuditLogs.Add(new AuditLog
        {
            Action = "CREATE_PACKAGE",
            EntityType = "SubscriptionPackage",
            EntityId = cleanCode,
            ActorName = _currentUser.Email ?? "Super Admin",
            ActorEmail = _currentUser.Email ?? "admin@platform.com",
            Details = $"Super Admin created subscription package tier: \"{pkg.Name}\" ({pkg.Tier}) with {pkg.Features.Count} modules.",
            Module = "Features",
            Status = "success",
            Timestamp = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetPackageById), new { id = pkg.Id }, ApiResponse<PackageResponseDto>.SuccessResult(MapToResponseDto(pkg, 0), "Package tier created successfully."));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<ApiResponse<PackageResponseDto>>> UpdatePackage(
        string id,
        [FromBody] UpdatePackageRequestDto req,
        CancellationToken ct = default)
    {
        var pkg = await FindPackageAsync(id, ct);
        if (pkg == null)
            return NotFound(ApiResponse<PackageResponseDto>.FailureResult("Subscription package not found."));

        if (!string.IsNullOrWhiteSpace(req.Name))
            pkg.Name = req.Name.Trim();

        if (req.Description != null)
            pkg.Description = req.Description.Trim();

        if (!string.IsNullOrWhiteSpace(req.Tier))
            pkg.Tier = req.Tier.Trim();

        if (req.PriceMonthly >= 0)
            pkg.PriceMonthly = req.PriceMonthly;

        if (!string.IsNullOrWhiteSpace(req.Currency))
            pkg.Currency = req.Currency.Trim();

        if (req.MaxUsers > 0)
            pkg.MaxUsers = req.MaxUsers;

        if (req.MaxStorageGb > 0)
            pkg.MaxStorageGb = req.MaxStorageGb;

        if (req.Features != null)
            pkg.Features = req.Features;

        pkg.IsPopular = req.IsPopular;
        pkg.IsActive = req.IsActive;
        pkg.UpdatedAt = DateTime.UtcNow;

        _context.AuditLogs.Add(new AuditLog
        {
            Action = "UPDATE_PACKAGE",
            EntityType = "SubscriptionPackage",
            EntityId = pkg.Id.ToString(),
            ActorName = _currentUser.Email ?? "Super Admin",
            ActorEmail = _currentUser.Email ?? "admin@platform.com",
            Details = $"Super Admin updated subscription package tier: \"{pkg.Name}\".",
            Module = "Features",
            Status = "success",
            Timestamp = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(ct);

        var enrolledCount = await _context.Tenants
            .CountAsync(t => t.SubscriptionPlan == pkg.Name || t.SubscriptionPlan == pkg.Code, ct);

        return Ok(ApiResponse<PackageResponseDto>.SuccessResult(MapToResponseDto(pkg, enrolledCount), "Package updated successfully."));
    }

    [HttpPatch("{id}/status")]
    public async Task<ActionResult<ApiResponse<PackageResponseDto>>> TogglePackageStatus(
        string id,
        [FromBody] PackageStatusUpdateDto req,
        CancellationToken ct = default)
    {
        var pkg = await FindPackageAsync(id, ct);
        if (pkg == null)
            return NotFound(ApiResponse<PackageResponseDto>.FailureResult("Subscription package not found."));

        pkg.IsActive = req.IsActive;
        pkg.UpdatedAt = DateTime.UtcNow;

        _context.AuditLogs.Add(new AuditLog
        {
            Action = req.IsActive ? "ACTIVATE_PACKAGE" : "DEACTIVATE_PACKAGE",
            EntityType = "SubscriptionPackage",
            EntityId = pkg.Id.ToString(),
            ActorName = _currentUser.Email ?? "Super Admin",
            ActorEmail = _currentUser.Email ?? "admin@platform.com",
            Details = $"Super Admin {(req.IsActive ? "activated" : "deactivated")} package tier: \"{pkg.Name}\".",
            Module = "Features",
            Status = "success",
            Timestamp = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(ct);

        var enrolledCount = await _context.Tenants
            .CountAsync(t => t.SubscriptionPlan == pkg.Name || t.SubscriptionPlan == pkg.Code, ct);

        return Ok(ApiResponse<PackageResponseDto>.SuccessResult(MapToResponseDto(pkg, enrolledCount), "Package status updated."));
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse<bool>>> DeletePackage(string id, CancellationToken ct = default)
    {
        var pkg = await FindPackageAsync(id, ct);
        if (pkg == null)
            return NotFound(ApiResponse<bool>.FailureResult("Subscription package not found."));

        var enrolledCount = await _context.Tenants
            .CountAsync(t => (t.SubscriptionPlan ?? "Starter CRM Tier") == pkg.Name || (t.SubscriptionPlan ?? "Starter CRM Tier") == pkg.Code, ct);

        if (enrolledCount > 0)
            return BadRequest(ApiResponse<bool>.FailureResult($"Cannot delete package tier '{pkg.Name}'. It is currently assigned to {enrolledCount} active tenant organization(s)."));

        var pkgName = pkg.Name;
        _context.SubscriptionPackages.Remove(pkg);

        _context.AuditLogs.Add(new AuditLog
        {
            Action = "DELETE_PACKAGE",
            EntityType = "SubscriptionPackage",
            EntityId = pkg.Id.ToString(),
            ActorName = _currentUser.Email ?? "Super Admin",
            ActorEmail = _currentUser.Email ?? "admin@platform.com",
            Details = $"Super Admin removed package tier: \"{pkgName}\".",
            Module = "Features",
            Status = "success",
            Timestamp = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(ct);
        return Ok(ApiResponse<bool>.SuccessResult(true, $"Package tier '{pkgName}' deleted successfully."));
    }

    private async Task<SubscriptionPackage?> FindPackageAsync(string id, CancellationToken ct)
    {
        if (int.TryParse(id, out var intId))
            return await _context.SubscriptionPackages.FirstOrDefaultAsync(p => p.Id == intId, ct);

        var code = id.Trim().ToLowerInvariant();
        return await _context.SubscriptionPackages.FirstOrDefaultAsync(p => p.Code.ToLower() == code, ct);
    }

    private static PackageResponseDto MapToResponseDto(SubscriptionPackage p, int enrolledCount)
    {
        return new PackageResponseDto
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
            Features = p.Features,
            IsPopular = p.IsPopular,
            IsActive = p.IsActive,
            EnrolledTenantsCount = enrolledCount,
            CreatedAt = p.CreatedAt,
            UpdatedAt = p.UpdatedAt
        };
    }
}
