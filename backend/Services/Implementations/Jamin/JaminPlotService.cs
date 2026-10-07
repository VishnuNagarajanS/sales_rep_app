using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.Jamin;
using backend.Models.Entities;
using backend.Services.Interfaces.Jamin;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Implementations.Jamin;

public class JaminPlotService : IJaminPlotService
{
    private readonly ApplicationDbContext _context;
    private const int JaminTenantId = 2;

    public JaminPlotService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<ApiResponse<List<JaminPlotResponseDto>>> GetPlotsAsync(int? projectId = null, string? status = null, CancellationToken ct = default)
    {
        var query = _context.JaminPlots.Where(p => p.CompanyId == JaminTenantId);

        if (projectId.HasValue && projectId.Value > 0)
        {
            query = query.Where(p => p.ProjectId == projectId.Value);
        }

        if (!string.IsNullOrEmpty(status) && status != "All")
        {
            query = query.Where(p => p.Status == status);
        }

        var plots = await query.OrderBy(p => p.PlotNumber).ToListAsync(ct);
        return ApiResponse<List<JaminPlotResponseDto>>.SuccessResult(plots.Select(MapToDto).ToList());
    }

    public async Task<ApiResponse<JaminPlotResponseDto>> GetPlotByIdAsync(int id, CancellationToken ct = default)
    {
        var plot = await _context.JaminPlots
            .FirstOrDefaultAsync(p => p.Id == id && p.CompanyId == JaminTenantId, ct);

        if (plot == null)
        {
            return ApiResponse<JaminPlotResponseDto>.FailureResult("Plot not found.");
        }

        return ApiResponse<JaminPlotResponseDto>.SuccessResult(MapToDto(plot));
    }

    public async Task<ApiResponse<JaminPlotResponseDto>> CreatePlotAsync(CreateJaminPlotDto dto, CancellationToken ct = default)
    {
        var project = await _context.JaminProjects
            .FirstOrDefaultAsync(p => p.Id == dto.ProjectId && p.CompanyId == JaminTenantId, ct);

        if (project == null)
        {
            return ApiResponse<JaminPlotResponseDto>.FailureResult("Project not found.");
        }

        var area = dto.AreaSqFt > 0 ? dto.AreaSqFt : 1200;
        var pricePerSqft = dto.PricePerSqft.HasValue && dto.PricePerSqft.Value > 0
            ? dto.PricePerSqft.Value
            : (area > 0 ? Math.Round(dto.Price / area, 2) : 0);

        var plot = new JaminPlot
        {
            CompanyId = JaminTenantId,
            ProjectId = dto.ProjectId,
            PlotNumber = dto.PlotNumber.Trim(),
            Dimensions = dto.Dimensions?.Trim() ?? "30 x 40",
            AreaSqFt = area,
            Facing = dto.Facing?.Trim() ?? "East",
            Status = "Available",
            Price = dto.Price,
            PricePerSqft = pricePerSqft,
            Notes = string.IsNullOrWhiteSpace(dto.Notes) ? null : dto.Notes.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        _context.JaminPlots.Add(plot);
        project.TotalPlots = await _context.JaminPlots.CountAsync(p => p.ProjectId == dto.ProjectId, ct) + 1;
        project.AvailablePlots = await _context.JaminPlots.CountAsync(p => p.ProjectId == dto.ProjectId && p.Status == "Available", ct) + 1;

        await _context.SaveChangesAsync(ct);

        return ApiResponse<JaminPlotResponseDto>.SuccessResult(MapToDto(plot), "Plot created successfully.");
    }

    public async Task<ApiResponse<JaminPlotResponseDto>> UpdatePlotAsync(int id, UpdateJaminPlotDto dto, CancellationToken ct = default)
    {
        var plot = await _context.JaminPlots
            .FirstOrDefaultAsync(p => p.Id == id && p.CompanyId == JaminTenantId, ct);

        if (plot == null)
        {
            return ApiResponse<JaminPlotResponseDto>.FailureResult("Plot not found.");
        }

        if (dto.PlotNumber != null) plot.PlotNumber = dto.PlotNumber.Trim();
        if (dto.Dimensions != null) plot.Dimensions = dto.Dimensions.Trim();
        if (dto.AreaSqFt.HasValue) plot.AreaSqFt = dto.AreaSqFt.Value;
        if (dto.Facing != null) plot.Facing = dto.Facing.Trim();
        if (dto.Status != null) plot.Status = dto.Status.Trim();
        if (dto.Price.HasValue) plot.Price = dto.Price.Value;
        if (dto.PricePerSqft.HasValue) plot.PricePerSqft = dto.PricePerSqft.Value;
        else if (dto.Price.HasValue && plot.AreaSqFt > 0) plot.PricePerSqft = Math.Round(dto.Price.Value / plot.AreaSqFt, 2);
        if (dto.HeldByCustomerId.HasValue) plot.HeldByCustomerId = dto.HeldByCustomerId.Value > 0 ? dto.HeldByCustomerId.Value : null;
        if (dto.HeldByCustomerName != null) plot.HeldByCustomerName = dto.HeldByCustomerName.Trim();
        if (dto.HeldByCustomerPhone != null) plot.HeldByCustomerPhone = dto.HeldByCustomerPhone.Trim();
        if (dto.HoldByAgent != null) plot.HoldByAgent = dto.HoldByAgent.Trim();
        if (dto.Notes != null) plot.Notes = string.IsNullOrWhiteSpace(dto.Notes) ? null : dto.Notes.Trim();

        plot.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);

        return ApiResponse<JaminPlotResponseDto>.SuccessResult(MapToDto(plot), "Plot updated successfully.");
    }

    public async Task<ApiResponse<JaminPlotResponseDto>> HoldPlotAsync(int id, HoldPlotRequestDto dto, CancellationToken ct = default)
    {
        var plot = await _context.JaminPlots
            .FirstOrDefaultAsync(p => p.Id == id && p.CompanyId == JaminTenantId, ct);

        if (plot == null)
        {
            return ApiResponse<JaminPlotResponseDto>.FailureResult("Plot not found.");
        }

        if (plot.Status != "Available")
        {
            return ApiResponse<JaminPlotResponseDto>.FailureResult($"Cannot hold plot in '{plot.Status}' status.");
        }

        int? resolvedCustomerId = dto.HeldByCustomerId;
        if (!resolvedCustomerId.HasValue && !string.IsNullOrWhiteSpace(dto.CustomerPhone))
        {
            var matchedCustomer = await _context.Customers
                .FirstOrDefaultAsync(c => c.Phone == dto.CustomerPhone.Trim() && c.CompanyId == JaminTenantId, ct);
            if (matchedCustomer != null)
            {
                resolvedCustomerId = matchedCustomer.Id;
            }
        }

        plot.Status = "Hold";
        plot.HeldByCustomerId = resolvedCustomerId;
        plot.HeldByCustomerName = dto.CustomerName.Trim();
        plot.HeldByCustomerPhone = dto.CustomerPhone.Trim();
        plot.HoldByAgent = dto.HoldByAgent?.Trim();
        plot.HoldExpiresAt = DateTime.UtcNow.AddDays(dto.HoldDays > 0 ? dto.HoldDays : 7);
        plot.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(ct);

        return ApiResponse<JaminPlotResponseDto>.SuccessResult(MapToDto(plot), "Plot placed on hold successfully.");
    }

    public async Task<ApiResponse<JaminPlotResponseDto>> ReleasePlotHoldAsync(int id, CancellationToken ct = default)
    {
        var plot = await _context.JaminPlots
            .FirstOrDefaultAsync(p => p.Id == id && p.CompanyId == JaminTenantId, ct);

        if (plot == null)
        {
            return ApiResponse<JaminPlotResponseDto>.FailureResult("Plot not found.");
        }

        plot.Status = "Available";
        plot.HeldByCustomerId = null;
        plot.HeldByCustomerName = null;
        plot.HeldByCustomerPhone = null;
        plot.HoldByAgent = null;
        plot.HoldExpiresAt = null;
        plot.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(ct);

        return ApiResponse<JaminPlotResponseDto>.SuccessResult(MapToDto(plot), "Plot hold released. Status is now Available.");
    }

    private static JaminPlotResponseDto MapToDto(JaminPlot p) => new()
    {
        Id = p.Id,
        CompanyId = p.CompanyId,
        ProjectId = p.ProjectId,
        PlotNumber = p.PlotNumber,
        Dimensions = p.Dimensions,
        AreaSqFt = p.AreaSqFt,
        Facing = p.Facing,
        Status = p.Status,
        Price = p.Price,
        PricePerSqft = p.PricePerSqft > 0 ? p.PricePerSqft : (p.AreaSqFt > 0 ? Math.Round(p.Price / p.AreaSqFt, 2) : 0),
        HeldByCustomerId = p.HeldByCustomerId,
        HeldByCustomerName = p.HeldByCustomerName,
        HeldByCustomerPhone = p.HeldByCustomerPhone,
        HoldByAgent = p.HoldByAgent,
        HoldExpiresAt = p.HoldExpiresAt,
        Notes = p.Notes,
        CreatedAt = p.CreatedAt,
        UpdatedAt = p.UpdatedAt
    };
}
