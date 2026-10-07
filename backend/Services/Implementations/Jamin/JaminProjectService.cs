using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.Jamin;
using backend.Models.Entities;
using backend.Services.Interfaces.Jamin;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Implementations.Jamin;

public class JaminProjectService : IJaminProjectService
{
    private readonly ApplicationDbContext _context;
    private const int JaminTenantId = 2;

    public JaminProjectService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<ApiResponse<List<JaminProjectResponseDto>>> GetProjectsAsync(string? status = null, CancellationToken ct = default)
    {
        try
        {
            var query = _context.JaminProjects
                .AsNoTracking()
                .Include(p => p.Plots)
                .AsSplitQuery()
                .Where(p => p.CompanyId == JaminTenantId);

            if (!string.IsNullOrEmpty(status) && status != "All")
            {
                query = query.Where(p => p.Status == status);
            }

            var projects = await query.OrderByDescending(p => p.CreatedAt).ToListAsync(ct);
            var allVisits = await _context.SiteVisits
                .AsNoTracking()
                .Where(s => s.TenantId == JaminTenantId)
                .ToListAsync(ct);

            var dtos = projects.Select(p =>
            {
                var dto = MapToDto(p);
                var matchCount = allVisits.Count(s =>
                    (s.ProjectId.HasValue && s.ProjectId.Value == p.Id) ||
                    (!string.IsNullOrEmpty(s.ProjectName) && s.ProjectName.Trim().Equals(p.Name.Trim(), StringComparison.OrdinalIgnoreCase))
                );
                dto.TotalSiteVisits = matchCount;
                return dto;
            }).ToList();

            return ApiResponse<List<JaminProjectResponseDto>>.SuccessResult(dtos);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[JaminProjectService Error] {ex.Message}");
            // Safe fallback without Include
            var fallback = await _context.JaminProjects
                .AsNoTracking()
                .Where(p => p.CompanyId == JaminTenantId)
                .OrderByDescending(p => p.CreatedAt)
                .ToListAsync(ct);

            var allVisits = await _context.SiteVisits
                .AsNoTracking()
                .Where(s => s.TenantId == JaminTenantId)
                .ToListAsync(ct);

            var dtos = fallback.Select(p =>
            {
                var dto = MapToDto(p);
                var matchCount = allVisits.Count(s =>
                    (s.ProjectId.HasValue && s.ProjectId.Value == p.Id) ||
                    (!string.IsNullOrEmpty(s.ProjectName) && s.ProjectName.Trim().Equals(p.Name.Trim(), StringComparison.OrdinalIgnoreCase))
                );
                dto.TotalSiteVisits = matchCount;
                return dto;
            }).ToList();

            return ApiResponse<List<JaminProjectResponseDto>>.SuccessResult(dtos);
        }
    }

    public async Task<ApiResponse<JaminProjectResponseDto>> GetProjectByIdAsync(int id, CancellationToken ct = default)
    {
        try
        {
            var project = await _context.JaminProjects
                .AsNoTracking()
                .Include(p => p.Plots)
                .FirstOrDefaultAsync(p => p.Id == id && p.CompanyId == JaminTenantId, ct);

            if (project == null)
            {
                return ApiResponse<JaminProjectResponseDto>.FailureResult("Project not found.");
            }

            var allVisits = await _context.SiteVisits
                .AsNoTracking()
                .Where(s => s.TenantId == JaminTenantId)
                .ToListAsync(ct);

            var dto = MapToDto(project);
            dto.TotalSiteVisits = allVisits.Count(s =>
                (s.ProjectId.HasValue && s.ProjectId.Value == project.Id) ||
                (!string.IsNullOrEmpty(s.ProjectName) && s.ProjectName.Trim().Equals(project.Name.Trim(), StringComparison.OrdinalIgnoreCase))
            );

            return ApiResponse<JaminProjectResponseDto>.SuccessResult(dto);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[JaminProjectService Error] {ex.Message}");
            var project = await _context.JaminProjects
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == id && p.CompanyId == JaminTenantId, ct);

            if (project == null) return ApiResponse<JaminProjectResponseDto>.FailureResult("Project not found.");
            var dto = MapToDto(project);
            return ApiResponse<JaminProjectResponseDto>.SuccessResult(dto);
        }
    }


    public async Task<ApiResponse<JaminProjectResponseDto>> CreateProjectAsync(CreateJaminProjectDto dto, CancellationToken ct = default)
    {
        var project = new JaminProject
        {
            CompanyId = JaminTenantId,
            Name = dto.Name.Trim(),
            Location = dto.Location.Trim(),
            Status = dto.Status ?? "Active",
            Description = dto.Description?.Trim() ?? string.Empty,
            TotalPlots = dto.TotalPlots,
            AvailablePlots = dto.TotalPlots,
            BookedPlots = 0,
            PriceRange = dto.PriceRange?.Trim() ?? string.Empty,
            ImageUrl = dto.ImageUrl,
            CreatedAt = DateTime.UtcNow
        };

        _context.JaminProjects.Add(project);
        await _context.SaveChangesAsync(ct);

        return ApiResponse<JaminProjectResponseDto>.SuccessResult(MapToDto(project), "Project created successfully.");
    }

    public async Task<ApiResponse<JaminProjectResponseDto>> UpdateProjectAsync(int id, UpdateJaminProjectDto dto, CancellationToken ct = default)
    {
        var project = await _context.JaminProjects
            .Include(p => p.Plots)
            .FirstOrDefaultAsync(p => p.Id == id && p.CompanyId == JaminTenantId, ct);

        if (project == null)
        {
            return ApiResponse<JaminProjectResponseDto>.FailureResult("Project not found.");
        }

        if (dto.Name != null) project.Name = dto.Name.Trim();
        if (dto.Location != null) project.Location = dto.Location.Trim();
        if (dto.Status != null) project.Status = dto.Status.Trim();
        if (dto.Description != null) project.Description = dto.Description.Trim();
        if (dto.TotalPlots.HasValue) project.TotalPlots = dto.TotalPlots.Value;
        if (dto.AvailablePlots.HasValue) project.AvailablePlots = dto.AvailablePlots.Value;
        if (dto.BookedPlots.HasValue) project.BookedPlots = dto.BookedPlots.Value;
        if (dto.PriceRange != null) project.PriceRange = dto.PriceRange.Trim();
        if (dto.ImageUrl != null) project.ImageUrl = dto.ImageUrl;

        project.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);

        return ApiResponse<JaminProjectResponseDto>.SuccessResult(MapToDto(project), "Project updated successfully.");
    }

    public async Task<ApiResponse<bool>> DeleteProjectAsync(int id, CancellationToken ct = default)
    {
        var project = await _context.JaminProjects
            .FirstOrDefaultAsync(p => p.Id == id && p.CompanyId == JaminTenantId, ct);

        if (project == null)
        {
            return ApiResponse<bool>.FailureResult("Project not found.");
        }

        var hasPlots = await _context.JaminPlots.AnyAsync(p => p.ProjectId == id && p.CompanyId == JaminTenantId, ct);
        var hasBookings = await _context.JaminBookings.AnyAsync(b => b.ProjectId == id && b.CompanyId == JaminTenantId, ct);
        var hasSiteVisits = await _context.SiteVisits.AnyAsync(s => s.ProjectId == id && s.TenantId == JaminTenantId, ct);
        if (hasPlots || hasBookings || hasSiteVisits)
        {
            return ApiResponse<bool>.FailureResult("Cannot delete a project that has plots, bookings, or site visits. Archive it instead.");
        }

        _context.JaminProjects.Remove(project);
        await _context.SaveChangesAsync(ct);

        return ApiResponse<bool>.SuccessResult(true, "Project deleted successfully.");
    }

    private static JaminProjectResponseDto MapToDto(JaminProject p)
    {
        var plots = p.Plots ?? new List<JaminPlot>();
        var hasPlots = plots.Count > 0;
        var availableCount = hasPlots ? plots.Count(pl => pl.Status == "Available") : p.AvailablePlots;
        var heldCount      = hasPlots ? plots.Count(pl => pl.Status == "Hold" || pl.Status == "Held") : 0;
        var registeredCount = hasPlots ? plots.Count(pl => pl.Status == "Registered") : 0;
        var bookedCount    = hasPlots 
            ? plots.Count(pl => pl.Status == "Booked" || pl.Status == "Registered" || pl.Status == "Sold") 
            : p.BookedPlots;

        var directVisits = p.SiteVisits?.Count ?? 0;
        var plotVisits = plots.Sum(pl => pl.SiteVisits?.Count ?? 0);
        var siteVisitCount = directVisits + plotVisits;

        var directBookings = p.Bookings?.Count ?? 0;
        var plotBookings = plots.Sum(pl => pl.Bookings?.Count ?? 0);
        var bookingCount = directBookings + plotBookings;

        return new JaminProjectResponseDto
        {
            Id = p.Id,
            CompanyId = p.CompanyId,
            Name = p.Name,
            Location = p.Location,
            Status = p.Status,
            Description = p.Description,
            TotalPlots = hasPlots ? plots.Count : p.TotalPlots,
            AvailablePlots = availableCount,
            BookedPlots = bookedCount,
            HeldPlots = heldCount,
            RegisteredPlots = registeredCount,
            TotalSiteVisits = siteVisitCount,
            TotalBookings = bookingCount,
            PriceRange = p.PriceRange,
            ImageUrl = p.ImageUrl,
            CreatedAt = p.CreatedAt,
            UpdatedAt = p.UpdatedAt
        };
    }
}
