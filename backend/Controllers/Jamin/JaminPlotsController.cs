using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.Jamin;
using backend.Extensions;
using backend.Models.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers.Jamin;

[ApiController]
[Route("api/jamin/plots")]
[Authorize]
public class JaminPlotsController : JaminTenantControllerBase
{
    private readonly ApplicationDbContext _db;
    public JaminPlotsController(ApplicationDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetPlots([FromQuery] int? projectId, [FromQuery] string? status, CancellationToken ct)
    {
        var companyId = JaminCompanyId;
        var query = _db.JaminPlots.AsNoTracking().Where(p => p.CompanyId == companyId);
        if (projectId.HasValue) query = query.Where(p => p.ProjectId == projectId.Value);
        if (!string.IsNullOrWhiteSpace(status) && status != "All") query = query.Where(p => p.Status == status);
        var plots = (await query.OrderBy(p => p.ProjectId).ThenBy(p => p.PlotNumber).ToListAsync(ct)).Select(ToDto).ToList();
        return Ok(ApiResponse<List<JaminPlotResponseDto>>.SuccessResult(plots));
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetPlot(int id, CancellationToken ct)
    {
        var plot = await _db.JaminPlots.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id && p.CompanyId == JaminCompanyId, ct);
        return plot == null ? NotFound(ApiResponse<JaminPlotResponseDto>.FailureResult("Plot not found."))
            : Ok(ApiResponse<JaminPlotResponseDto>.SuccessResult(ToDto(plot)));
    }

    [HttpPost]
    [Authorize(Roles = "company_admin,super_admin")]
    public async Task<IActionResult> CreatePlot([FromBody] CreateJaminPlotDto dto, CancellationToken ct)
    {
        var companyId = JaminCompanyId;
        if (dto.ProjectId <= 0 || string.IsNullOrWhiteSpace(dto.PlotNumber) || dto.AreaSqFt <= 0 || dto.Price < 0)
            return BadRequest(ApiResponse<JaminPlotResponseDto>.FailureResult("Project, plot number, positive area, and non-negative price are required."));
        var project = await _db.JaminProjects.FirstOrDefaultAsync(p => p.Id == dto.ProjectId && p.CompanyId == companyId, ct);
        if (project == null) return BadRequest(ApiResponse<JaminPlotResponseDto>.FailureResult("Project not found."));
        var duplicate = await _db.JaminPlots.AnyAsync(p => p.ProjectId == dto.ProjectId && p.PlotNumber == dto.PlotNumber.Trim(), ct);
        if (duplicate) return Conflict(ApiResponse<JaminPlotResponseDto>.FailureResult("This plot number already exists in the project."));

        var plot = new JaminPlot
        {
            CompanyId = companyId, ProjectId = project.Id, PlotNumber = dto.PlotNumber.Trim(),
            Dimensions = dto.Dimensions?.Trim() ?? "30 x 40", AreaSqFt = dto.AreaSqFt,
            Facing = dto.Facing?.Trim() ?? "East", Status = "Available", Price = dto.Price,
            Notes = dto.Notes?.Trim(), CreatedAt = DateTime.UtcNow
        };
        _db.JaminPlots.Add(plot);
        project.TotalPlots++;
        project.AvailablePlots++;
        project.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetPlot), new { id = plot.Id }, ApiResponse<JaminPlotResponseDto>.SuccessResult(ToDto(plot), "Plot created."));
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "company_admin,super_admin")]
    public async Task<IActionResult> UpdatePlot(int id, [FromBody] UpdateJaminPlotDto dto, CancellationToken ct)
    {
        var plot = await _db.JaminPlots.FirstOrDefaultAsync(p => p.Id == id && p.CompanyId == JaminCompanyId, ct);
        if (plot == null) return NotFound(ApiResponse<JaminPlotResponseDto>.FailureResult("Plot not found."));
        if (dto.AreaSqFt is <= 0 || dto.Price is < 0 || dto.PlotNumber != null && string.IsNullOrWhiteSpace(dto.PlotNumber))
            return BadRequest(ApiResponse<JaminPlotResponseDto>.FailureResult("Plot number, area, or price is invalid."));
        if (dto.Status != null && dto.Status is not ("Available" or "Hold" or "Booked" or "Registered" or "Sold"))
            return BadRequest(ApiResponse<JaminPlotResponseDto>.FailureResult("Invalid plot status."));
        if (dto.PlotNumber != null) plot.PlotNumber = dto.PlotNumber.Trim();
        if (dto.Dimensions != null) plot.Dimensions = dto.Dimensions.Trim();
        if (dto.AreaSqFt.HasValue) plot.AreaSqFt = dto.AreaSqFt.Value;
        if (dto.Facing != null) plot.Facing = dto.Facing.Trim();
        if (dto.Price.HasValue) plot.Price = dto.Price.Value;
        if (dto.Notes != null) plot.Notes = dto.Notes.Trim();
        if (dto.Status != null && dto.Status != plot.Status)
        {
            var wasCountedBooked = IsBooked(plot.Status);
            var becomesCountedBooked = IsBooked(dto.Status);
            var project = await _db.JaminProjects.FirstOrDefaultAsync(p => p.Id == plot.ProjectId && p.CompanyId == plot.CompanyId, ct);
            if (project != null && wasCountedBooked != becomesCountedBooked)
            {
                project.BookedPlots = Math.Max(0, project.BookedPlots + (becomesCountedBooked ? 1 : -1));
                project.AvailablePlots = Math.Max(0, project.AvailablePlots + (becomesCountedBooked ? -1 : 1));
                project.UpdatedAt = DateTime.UtcNow;
            }
            plot.Status = dto.Status;
        }
        plot.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(ApiResponse<JaminPlotResponseDto>.SuccessResult(ToDto(plot), "Plot updated."));
    }

    [HttpPost("{id:int}/hold")]
    public async Task<IActionResult> HoldPlot(int id, [FromBody] HoldPlotRequestDto dto, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(dto.CustomerName) || string.IsNullOrWhiteSpace(dto.CustomerPhone) || dto.HoldDays is < 1 or > 30)
            return BadRequest(ApiResponse<JaminPlotResponseDto>.FailureResult("Customer name, phone, and a hold period between 1 and 30 days are required."));
        var plot = await _db.JaminPlots.FirstOrDefaultAsync(p => p.Id == id && p.CompanyId == JaminCompanyId, ct);
        if (plot == null) return NotFound(ApiResponse<JaminPlotResponseDto>.FailureResult("Plot not found."));
        if (plot.Status == "Hold" && plot.HoldExpiresAt <= DateTime.UtcNow)
        {
            plot.Status = "Available"; plot.HeldByCustomerName = null; plot.HeldByCustomerPhone = null; plot.HoldExpiresAt = null;
        }
        if (plot.Status != "Available") return Conflict(ApiResponse<JaminPlotResponseDto>.FailureResult("Only available plots can be placed on hold."));
        plot.Status = "Hold"; plot.HeldByCustomerName = dto.CustomerName.Trim(); plot.HeldByCustomerPhone = dto.CustomerPhone.Trim();
        plot.HoldExpiresAt = DateTime.UtcNow.AddDays(dto.HoldDays); plot.Notes = dto.Notes?.Trim(); plot.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(ApiResponse<JaminPlotResponseDto>.SuccessResult(ToDto(plot), "Plot placed on hold."));
    }

    [HttpPost("{id:int}/release")]
    public async Task<IActionResult> ReleasePlotHold(int id, CancellationToken ct)
    {
        var plot = await _db.JaminPlots.FirstOrDefaultAsync(p => p.Id == id && p.CompanyId == JaminCompanyId, ct);
        if (plot == null) return NotFound(ApiResponse<JaminPlotResponseDto>.FailureResult("Plot not found."));
        if (plot.Status != "Hold") return Conflict(ApiResponse<JaminPlotResponseDto>.FailureResult("Plot is not on hold."));
        plot.Status = "Available"; plot.HeldByCustomerName = null; plot.HeldByCustomerPhone = null; plot.HoldExpiresAt = null;
        plot.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(ApiResponse<JaminPlotResponseDto>.SuccessResult(ToDto(plot), "Plot hold released."));
    }

    private static JaminPlotResponseDto ToDto(JaminPlot p) => new()
    {
        Id = p.Id, CompanyId = p.CompanyId, ProjectId = p.ProjectId, PlotNumber = p.PlotNumber,
        Dimensions = p.Dimensions, AreaSqFt = p.AreaSqFt, Facing = p.Facing, Status = p.Status,
        Price = p.Price, HeldByCustomerName = p.HeldByCustomerName, HeldByCustomerPhone = p.HeldByCustomerPhone,
        HoldExpiresAt = p.HoldExpiresAt, Notes = p.Notes, CreatedAt = p.CreatedAt, UpdatedAt = p.UpdatedAt
    };

    private static bool IsBooked(string status) => status is "Booked" or "Registered" or "Sold";
}
