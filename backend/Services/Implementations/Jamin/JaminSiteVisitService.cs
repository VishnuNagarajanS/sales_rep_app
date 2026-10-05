using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.Jamin;
using backend.Models.Entities;
using backend.Services.Interfaces.Jamin;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Implementations.Jamin;

public class JaminSiteVisitService : IJaminSiteVisitService
{
    private readonly ApplicationDbContext _context;
    private const int JaminTenantId = 2;

    public JaminSiteVisitService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<ApiResponse<List<JaminSiteVisitDto>>> GetSiteVisitsAsync(int? agentId = null, string? status = null, CancellationToken ct = default)
    {
        try
        {
            var query = _context.SiteVisits.Where(s => s.TenantId == JaminTenantId);

            if (agentId.HasValue && agentId.Value > 0)
            {
                query = query.Where(s => s.AssignedAgentId == agentId.Value);
            }

            if (!string.IsNullOrEmpty(status) && status != "All")
            {
                query = query.Where(s => s.Status == status);
            }

            var visits = await query.OrderByDescending(s => s.CreatedAt).ToListAsync(ct);
            return ApiResponse<List<JaminSiteVisitDto>>.SuccessResult(visits.Select(MapToDto).ToList());
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[JaminSiteVisitService Error] {ex.Message}");
            return ApiResponse<List<JaminSiteVisitDto>>.SuccessResult(new List<JaminSiteVisitDto>());
        }
    }


    public async Task<ApiResponse<JaminSiteVisitDto>> ScheduleSiteVisitAsync(ScheduleSiteVisitRequestDto dto, CancellationToken ct = default)
    {
        int? resolvedProjectId = dto.ProjectId;
        int? resolvedPlotId = dto.PlotId;
        string projectName = dto.ProjectName;
        string? plotNumber = dto.PlotNumber;

        // If PlotId is provided, resolve ProjectId, ProjectName, PlotNumber from the plot
        if (resolvedPlotId.HasValue)
        {
            var plot = await _context.JaminPlots
                .Include(p => p.Project)
                .FirstOrDefaultAsync(p => p.Id == resolvedPlotId && p.CompanyId == JaminTenantId, ct);
            if (plot != null)
            {
                resolvedProjectId ??= plot.ProjectId;
                projectName = plot.Project?.Name ?? projectName;
                plotNumber = plot.PlotNumber;
            }
        }
        // If only ProjectId is provided, resolve ProjectName
        else if (resolvedProjectId.HasValue && string.IsNullOrWhiteSpace(projectName))
        {
            var project = await _context.JaminProjects
                .FirstOrDefaultAsync(p => p.Id == resolvedProjectId && p.CompanyId == JaminTenantId, ct);
            if (project != null)
            {
                projectName = project.Name;
            }
        }

        var siteVisit = new SiteVisit
        {
            TenantId = JaminTenantId,
            LeadId = dto.LeadId,
            CustomerId = dto.CustomerId,
            ProjectId = resolvedProjectId,
            PlotId = resolvedPlotId,
            CustomerName = dto.CustomerName.Trim(),
            CustomerPhone = dto.CustomerPhone.Trim(),
            ContactType = dto.ContactType ?? "lead",
            ProjectName = projectName,
            PlotNumber = plotNumber,
            ScheduledAt = dto.ScheduledAt,
            AssignedAgentId = dto.AssignedAgentId,
            AssignedAgentName = dto.AssignedAgentName ?? string.Empty,
            Status = "Scheduled",
            VisitorNote = dto.VisitorNote,
            OutcomeNotes = dto.OutcomeNotes,
            CreatedAt = DateTime.UtcNow
        };

        _context.SiteVisits.Add(siteVisit);
        await _context.SaveChangesAsync(ct);

        return ApiResponse<JaminSiteVisitDto>.SuccessResult(MapToDto(siteVisit), "Site visit scheduled successfully.");
    }

    public async Task<ApiResponse<JaminSiteVisitDto>> ConfirmSiteVisitAsync(int id, CancellationToken ct = default)
    {
        var visit = await _context.SiteVisits.FirstOrDefaultAsync(s => s.Id == id && s.TenantId == JaminTenantId, ct);
        if (visit == null)
        {
            return ApiResponse<JaminSiteVisitDto>.FailureResult("Site visit not found.");
        }

        visit.Status = "Scheduled";
        visit.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);

        return ApiResponse<JaminSiteVisitDto>.SuccessResult(MapToDto(visit), "Site visit confirmed.");
    }

    public async Task<ApiResponse<JaminSiteVisitDto>> CompleteSiteVisitAsync(int id, UpdateSiteVisitOutcomeDto dto, CancellationToken ct = default)
    {
        var visit = await _context.SiteVisits.FirstOrDefaultAsync(s => s.Id == id && s.TenantId == JaminTenantId, ct);
        if (visit == null)
        {
            return ApiResponse<JaminSiteVisitDto>.FailureResult("Site visit not found.");
        }

        visit.Status = dto.Status ?? "Completed";
        if (!string.IsNullOrEmpty(dto.OutcomeNotes))
        {
            visit.OutcomeNotes = dto.OutcomeNotes;
        }
        visit.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);

        return ApiResponse<JaminSiteVisitDto>.SuccessResult(MapToDto(visit), "Site visit marked as completed.");
    }

    public async Task<ApiResponse<List<JaminSiteVisitDto>>> GetLeadSiteVisitsAsync(int leadId, CancellationToken ct = default)
    {
        var visits = await _context.SiteVisits
            .Where(s => s.TenantId == JaminTenantId && s.LeadId == leadId)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync(ct);

        return ApiResponse<List<JaminSiteVisitDto>>.SuccessResult(visits.Select(MapToDto).ToList());
    }

    public async Task<ApiResponse<bool>> DeleteSiteVisitAsync(int id, CancellationToken ct = default)
    {
        var visit = await _context.SiteVisits.FirstOrDefaultAsync(s => s.Id == id && s.TenantId == JaminTenantId, ct);
        if (visit == null)
        {
            return ApiResponse<bool>.FailureResult("Site visit not found.");
        }

        _context.SiteVisits.Remove(visit);
        await _context.SaveChangesAsync(ct);

        return ApiResponse<bool>.SuccessResult(true, "Site visit deleted successfully.");
    }

    private static JaminSiteVisitDto MapToDto(SiteVisit s) => new()
    {
        Id = s.Id,
        TenantId = s.TenantId,
        LeadId = s.LeadId,
        CustomerId = s.CustomerId,
        ProjectId = s.ProjectId,
        PlotId = s.PlotId,
        CustomerName = s.CustomerName,
        CustomerPhone = s.CustomerPhone,
        ContactType = s.ContactType,
        ProjectName = s.ProjectName,
        PlotNumber = s.PlotNumber,
        ScheduledAt = s.ScheduledAt,
        AssignedAgentId = s.AssignedAgentId,
        AssignedAgentName = s.AssignedAgentName,
        Status = s.Status,
        VisitorNote = s.VisitorNote,
        OutcomeNotes = s.OutcomeNotes,
        CreatedAt = s.CreatedAt
    };
}

