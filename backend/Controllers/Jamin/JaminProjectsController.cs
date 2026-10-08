using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.Jamin;
using backend.Extensions;
using backend.Models.Entities;
using backend.Services.Interfaces.Jamin;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers.Jamin;

[ApiController]
[Route("api/jamin/projects")]
[Authorize]
public class JaminProjectsController : JaminTenantControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IJaminProjectService _projectService;

    public JaminProjectsController(ApplicationDbContext db, IJaminProjectService projectService)
    {
        _db = db;
        _projectService = projectService;
    }

    [HttpGet]
    public async Task<IActionResult> GetProjects([FromQuery] string? status, CancellationToken ct)
    {
        var result = await _projectService.GetProjectsAsync(status, ct);
        return Ok(result);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetProjectById(int id, CancellationToken ct)
    {
        var result = await _projectService.GetProjectByIdAsync(id, ct);
        return result.Success ? Ok(result) : NotFound(result);
    }

    [HttpPost]
    [Authorize(Roles = "company_admin,super_admin")]
    public async Task<IActionResult> CreateProject([FromBody] CreateJaminProjectDto dto, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(dto.Name) || string.IsNullOrWhiteSpace(dto.Location) || dto.TotalPlots < 0)
            return BadRequest(ApiResponse<JaminProjectResponseDto>.FailureResult("Project name and location are required and total plots cannot be negative."));

        var project = new JaminProject
        {
            CompanyId = JaminCompanyId, Name = dto.Name.Trim(), Location = dto.Location.Trim(),
            Status = string.IsNullOrWhiteSpace(dto.Status) ? "Active" : dto.Status.Trim(),
            Description = dto.Description?.Trim() ?? string.Empty, TotalPlots = dto.TotalPlots,
            AvailablePlots = dto.TotalPlots, BookedPlots = 0, PriceRange = dto.PriceRange?.Trim() ?? string.Empty,
            ImageUrl = dto.ImageUrl?.Trim(), CreatedAt = DateTime.UtcNow
        };
        _db.JaminProjects.Add(project);
        await _db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetProjectById), new { id = project.Id },
            ApiResponse<JaminProjectResponseDto>.SuccessResult(ToDto(project), "Project created."));
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "company_admin,super_admin")]
    public async Task<IActionResult> UpdateProject(int id, [FromBody] UpdateJaminProjectDto dto, CancellationToken ct)
    {
        var project = await _db.JaminProjects.FirstOrDefaultAsync(p => p.Id == id && p.CompanyId == JaminCompanyId, ct);
        if (project == null) return NotFound(ApiResponse<JaminProjectResponseDto>.FailureResult("Project not found."));
        if (dto.Name != null && string.IsNullOrWhiteSpace(dto.Name) || dto.Location != null && string.IsNullOrWhiteSpace(dto.Location))
            return BadRequest(ApiResponse<JaminProjectResponseDto>.FailureResult("Project name and location cannot be blank."));
        if (dto.Name != null) project.Name = dto.Name.Trim();
        if (dto.Location != null) project.Location = dto.Location.Trim();
        if (dto.Status != null) project.Status = dto.Status.Trim();
        if (dto.Description != null) project.Description = dto.Description.Trim();
        if (dto.PriceRange != null) project.PriceRange = dto.PriceRange.Trim();
        if (dto.ImageUrl != null) project.ImageUrl = dto.ImageUrl.Trim();
        if (dto.TotalPlots.HasValue)
        {
            var currentPlots = await _db.JaminPlots
                .Where(p => p.ProjectId == id && p.CompanyId == project.CompanyId)
                .ToListAsync(ct);
            if (dto.TotalPlots.Value < currentPlots.Count)
            {
                var removeCount = currentPlots.Count - dto.TotalPlots.Value;
                var tailPlots = currentPlots
                    .OrderByDescending(p => int.TryParse(p.PlotNumber.Trim(), out var number) ? number : int.MinValue)
                    .Take(removeCount)
                    .ToList();
                var tailPlotIds = tailPlots.Select(p => p.Id).ToHashSet();
                var linkedPlotIds = (await _db.JaminBookings
                    .Where(b => b.CompanyId == project.CompanyId && b.PlotId.HasValue && tailPlotIds.Contains(b.PlotId.Value))
                    .Select(b => b.PlotId!.Value)
                    .Concat(_db.SiteVisits
                        .Where(s => s.TenantId == project.CompanyId && s.PlotId.HasValue && tailPlotIds.Contains(s.PlotId.Value))
                        .Select(s => s.PlotId!.Value))
                    .Distinct()
                    .ToListAsync(ct)).ToHashSet();
                var blockedPlots = tailPlots.Where(p => p.Status != "Available" || linkedPlotIds.Contains(p.Id)).ToList();
                if (blockedPlots.Count > 0)
                {
                    var statuses = string.Join(", ", blockedPlots.Select(p => $"Plot {p.PlotNumber}: {p.Status}"));
                    return Conflict(ApiResponse<JaminProjectResponseDto>.FailureResult(
                        $"Inventory update stopped. The last {removeCount} plots include protected records ({statuses}). No plots were deleted or renumbered."));
                }
            }
            project.TotalPlots = dto.TotalPlots.Value;
        }

        // Dynamically recalculate plots if actual individual plots exist in DB
        var existingPlots = await _db.JaminPlots.Where(p => p.ProjectId == id && p.CompanyId == project.CompanyId).ToListAsync(ct);
        if (existingPlots.Count > 0)
        {
            project.BookedPlots = existingPlots.Count(p => p.Status == "Booked" || p.Status == "Registered" || p.Status == "Sold");
            project.AvailablePlots = Math.Max(0, project.TotalPlots - project.BookedPlots);
        }
        else
        {
            if (dto.BookedPlots.HasValue) project.BookedPlots = dto.BookedPlots.Value;
            if (dto.AvailablePlots.HasValue)
            {
                project.AvailablePlots = dto.AvailablePlots.Value;
            }
            else
            {
                project.AvailablePlots = Math.Max(0, project.TotalPlots - project.BookedPlots);
            }
        }

        if (project.AvailablePlots < 0) project.AvailablePlots = 0;
        if (project.BookedPlots < 0) project.BookedPlots = 0;
        if (project.AvailablePlots + project.BookedPlots > project.TotalPlots)
        {
            project.AvailablePlots = Math.Max(0, project.TotalPlots - project.BookedPlots);
        }

        project.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        var result = await ProjectQuery(project.CompanyId).FirstAsync(p => p.Id == id, ct);
        return Ok(ApiResponse<JaminProjectResponseDto>.SuccessResult(result, "Project updated."));
    }

    [HttpPost("{id:int}/generate-plots")]
    [Authorize(Roles = "company_admin,super_admin")]
    public async Task<IActionResult> GeneratePlots(int id, CancellationToken ct)
    {
        var project = await _db.JaminProjects.FirstOrDefaultAsync(p => p.Id == id && p.CompanyId == JaminCompanyId, ct);
        if (project == null) return NotFound(ApiResponse<object>.FailureResult("Project not found."));

        var plots = await _db.JaminPlots
            .Where(p => p.ProjectId == id && p.CompanyId == JaminCompanyId)
            .ToListAsync(ct);
        var removeCount = 0;
        if (project.TotalPlots < plots.Count)
        {
            removeCount = plots.Count - project.TotalPlots;
            var tailPlots = plots
                .OrderByDescending(p => int.TryParse(p.PlotNumber.Trim(), out var number) ? number : int.MinValue)
                .Take(removeCount)
                .ToList();
            var tailPlotIds = tailPlots.Select(p => p.Id).ToHashSet();
            var linkedPlotIds = (await _db.JaminBookings
                .Where(b => b.CompanyId == JaminCompanyId && b.PlotId.HasValue && tailPlotIds.Contains(b.PlotId.Value))
                .Select(b => b.PlotId!.Value)
                .Concat(_db.SiteVisits
                    .Where(s => s.TenantId == JaminCompanyId && s.PlotId.HasValue && tailPlotIds.Contains(s.PlotId.Value))
                    .Select(s => s.PlotId!.Value))
                .Distinct()
                .ToListAsync(ct)).ToHashSet();
            var blockedPlots = tailPlots
                .Where(p => p.Status != "Available" || linkedPlotIds.Contains(p.Id))
                .ToList();
            if (blockedPlots.Count > 0)
            {
                var locked = string.Join(", ", blockedPlots.Select(p => $"Plot {p.PlotNumber}: {p.Status}"));
                return Conflict(ApiResponse<object>.FailureResult(
                    $"Inventory update stopped. The last {removeCount} plots include protected records ({locked}). No plots were deleted or renumbered."));
            }
            _db.JaminPlots.RemoveRange(tailPlots);
            plots = plots.Except(tailPlots).ToList();
        }

        var existingNumbers = plots
            .Select(p => p.PlotNumber.Trim())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var nextNumber = 1;
        for (var index = plots.Count; index < project.TotalPlots; index++)
        {
            while (existingNumbers.Contains(nextNumber.ToString())) nextNumber++;
            var plot = new JaminPlot
            {
                CompanyId = JaminCompanyId,
                ProjectId = project.Id,
                PlotNumber = nextNumber.ToString(),
                Dimensions = string.Empty,
                AreaSqFt = 0,
                Facing = string.Empty,
                Status = "Available",
                Price = 0,
                Notes = null,
                CreatedAt = DateTime.UtcNow
            };
            _db.JaminPlots.Add(plot);
            existingNumbers.Add(plot.PlotNumber);
            nextNumber++;
        }

        project.BookedPlots = plots.Count(p => p.Status is "Booked" or "Registered" or "Sold");
        project.AvailablePlots = project.TotalPlots - project.BookedPlots;
        project.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(ApiResponse<object>.SuccessResult(new
        {
            projectId = project.Id,
            createdCount = project.TotalPlots - plots.Count,
            removedCount = removeCount,
            totalPlots = project.TotalPlots
        }, "Plot inventory synchronized."));
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "company_admin,super_admin")]
    public async Task<IActionResult> DeleteProject(int id, CancellationToken ct)
    {
        var result = await _projectService.DeleteProjectAsync(id, ct);
        return result.Success ? Ok(result) : NotFound(result);
    }

    private IQueryable<JaminProjectResponseDto> ProjectQuery(int companyId) => _db.JaminProjects.AsNoTracking()
        .Where(p => p.CompanyId == companyId)
        .Select(p => new JaminProjectResponseDto
        {
            Id = p.Id, CompanyId = p.CompanyId, Name = p.Name, Location = p.Location,
            Status = p.Status, Description = p.Description, TotalPlots = p.TotalPlots,
            AvailablePlots = p.AvailablePlots, BookedPlots = p.BookedPlots,
            PriceRange = p.PriceRange, ImageUrl = p.ImageUrl, CreatedAt = p.CreatedAt, UpdatedAt = p.UpdatedAt
        });

    private static JaminProjectResponseDto ToDto(JaminProject p) => new()
    {
        Id = p.Id, CompanyId = p.CompanyId, Name = p.Name, Location = p.Location, Status = p.Status,
        Description = p.Description, TotalPlots = p.TotalPlots, AvailablePlots = p.AvailablePlots,
        BookedPlots = p.BookedPlots, PriceRange = p.PriceRange, ImageUrl = p.ImageUrl, CreatedAt = p.CreatedAt,
        UpdatedAt = p.UpdatedAt
    };
}

