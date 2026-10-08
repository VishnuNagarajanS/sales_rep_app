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
    private static readonly string[] SiteVisitStatuses = { "Requested", "Pending", "Scheduled", "Completed", "Rescheduled", "Cancelled", "No-show" };

    public JaminSiteVisitService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<ApiResponse<List<JaminSiteVisitDto>>> GetSiteVisitsAsync(int? agentId = null, string? status = null, int? leadId = null, int? customerId = null, CancellationToken ct = default)
    {
        var query = _context.SiteVisits.Where(s => s.TenantId == JaminTenantId);

        if (agentId.HasValue && agentId.Value > 0)
        {
            query = query.Where(s => s.AssignedAgentId == agentId.Value);
        }

        if (leadId.HasValue && leadId.Value > 0)
        {
            query = query.Where(s => s.LeadId == leadId.Value);
        }

        if (customerId.HasValue && customerId.Value > 0)
        {
            query = query.Where(s => s.CustomerId == customerId.Value);
        }

        if (!string.IsNullOrEmpty(status) && status != "All")
        {
            query = query.Where(s => s.Status == status);
        }

        var visits = await query.OrderByDescending(s => s.CreatedAt).ToListAsync(ct);
        return ApiResponse<List<JaminSiteVisitDto>>.SuccessResult(visits.Select(MapToDto).ToList());
    }


    public async Task<ApiResponse<JaminSiteVisitDto>> ScheduleSiteVisitAsync(ScheduleSiteVisitRequestDto dto, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(dto.CustomerName) || string.IsNullOrWhiteSpace(dto.CustomerPhone))
            return ApiResponse<JaminSiteVisitDto>.FailureResult("Visitor name and phone are required.");
        if (dto.LeadId.HasValue && dto.CustomerId.HasValue)
            return ApiResponse<JaminSiteVisitDto>.FailureResult("A site visit can be linked to either a lead or a customer, not both.");
        if (dto.LeadId is <= 0 || dto.CustomerId is <= 0)
            return ApiResponse<JaminSiteVisitDto>.FailureResult("Contact IDs must be positive.");

        // Auto-resolve Lead or Customer by phone if neither is specified
        if (!dto.LeadId.HasValue && !dto.CustomerId.HasValue && !string.IsNullOrWhiteSpace(dto.CustomerPhone))
        {
            var phone = dto.CustomerPhone.Trim();
            var customerMatch = await _context.Customers.FirstOrDefaultAsync(c => c.CompanyId == JaminTenantId && c.Phone == phone, ct);
            if (customerMatch != null)
            {
                dto.CustomerId = customerMatch.Id;
                dto.ContactType = "customer";
            }
            else
            {
                var leadMatch = await _context.Leads.FirstOrDefaultAsync(l => l.CompanyId == JaminTenantId && l.Phone == phone, ct);
                if (leadMatch != null)
                {
                    dto.LeadId = leadMatch.Id;
                    dto.ContactType = "lead";
                }
            }
        }

        if (dto.LeadId.HasValue)
        {
            var lead = await _context.Leads.FirstOrDefaultAsync(l => l.Id == dto.LeadId.Value && l.CompanyId == JaminTenantId, ct);
            if (lead == null) return ApiResponse<JaminSiteVisitDto>.FailureResult("Active Jamin lead not found.");
        }
        if (dto.CustomerId.HasValue)
        {
            var customer = await _context.Customers.FirstOrDefaultAsync(c => c.Id == dto.CustomerId.Value && c.CompanyId == JaminTenantId, ct);
            if (customer == null) return ApiResponse<JaminSiteVisitDto>.FailureResult("Jamin customer not found.");
        }
        if (dto.AssignedAgentId.HasValue && !await _context.Users.AnyAsync(
                u => u.Id == dto.AssignedAgentId.Value && u.CompanyId == JaminTenantId, ct))
            return ApiResponse<JaminSiteVisitDto>.FailureResult("Selected host does not belong to Jamin.");

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
                if (resolvedProjectId.HasValue && resolvedProjectId.Value != plot.ProjectId)
                    return ApiResponse<JaminSiteVisitDto>.FailureResult("Selected plot does not belong to the selected project.");
                resolvedProjectId ??= plot.ProjectId;
                projectName = plot.Project?.Name ?? projectName;
                plotNumber = plot.PlotNumber;
            }
            else
            {
                return ApiResponse<JaminSiteVisitDto>.FailureResult("Selected plot not found in Jamin inventory.");
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
            else
            {
                return ApiResponse<JaminSiteVisitDto>.FailureResult("Selected project not found in Jamin.");
            }
        }

        if (resolvedProjectId.HasValue && !await _context.JaminProjects.AnyAsync(p => p.Id == resolvedProjectId.Value && p.CompanyId == JaminTenantId, ct))
            return ApiResponse<JaminSiteVisitDto>.FailureResult("Selected project not found in Jamin.");

        var siteVisit = new SiteVisit
        {
            TenantId = JaminTenantId,
            LeadId = dto.LeadId,
            CustomerId = dto.CustomerId,
            ProjectId = resolvedProjectId,
            PlotId = resolvedPlotId,
            CustomerName = dto.CustomerName.Trim(),
            CustomerPhone = dto.CustomerPhone.Trim(),
            ContactType = dto.CustomerId.HasValue ? "customer" : dto.LeadId.HasValue ? "lead" : null,
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
        if (visit.Status is "Completed" or "Cancelled" or "No-show")
        {
            return ApiResponse<JaminSiteVisitDto>.FailureResult("Completed, cancelled, or no-show visits cannot be confirmed.");
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
        if (visit.Status is "Completed" or "Cancelled" or "No-show")
        {
            return ApiResponse<JaminSiteVisitDto>.FailureResult("This site visit is already closed.");
        }
        var outcomeStatus = string.IsNullOrWhiteSpace(dto.Status) ? "Completed" : dto.Status.Trim();
        if (outcomeStatus is not ("Completed" or "No-show"))
        {
            return ApiResponse<JaminSiteVisitDto>.FailureResult("A completed visit must be marked Completed or No-show.");
        }

        visit.Status = outcomeStatus;
        if (!string.IsNullOrEmpty(dto.OutcomeNotes))
        {
            visit.OutcomeNotes = dto.OutcomeNotes;
        }
        visit.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);

        return ApiResponse<JaminSiteVisitDto>.SuccessResult(MapToDto(visit), "Site visit marked as completed.");
    }

    public async Task<ApiResponse<JaminSiteVisitDto>> UpdateSiteVisitAsync(int id, UpdateSiteVisitDto dto, CancellationToken ct = default)
    {
        var visit = await _context.SiteVisits.FirstOrDefaultAsync(s => s.Id == id && s.TenantId == JaminTenantId, ct);
        if (visit == null)
        {
            return ApiResponse<JaminSiteVisitDto>.FailureResult("Site visit not found.");
        }

        if (!string.IsNullOrWhiteSpace(dto.Status))
        {
            var requestedStatus = dto.Status.Trim();
            if (!SiteVisitStatuses.Contains(requestedStatus, StringComparer.OrdinalIgnoreCase))
            {
                return ApiResponse<JaminSiteVisitDto>.FailureResult("Invalid site visit status.");
            }
            if (visit.Status is "Completed" or "No-show")
            {
                return ApiResponse<JaminSiteVisitDto>.FailureResult("Completed or no-show visits cannot be changed.");
            }
            if (visit.Status == "Cancelled" && !string.Equals(requestedStatus, "Cancelled", StringComparison.OrdinalIgnoreCase))
            {
                return ApiResponse<JaminSiteVisitDto>.FailureResult("Cancelled visits cannot be reopened.");
            }
        }

        if (!string.IsNullOrWhiteSpace(dto.ScheduledAt)) visit.ScheduledAt = dto.ScheduledAt.Trim();
        if (dto.ProjectId.HasValue && !await _context.JaminProjects.AnyAsync(
                p => p.Id == dto.ProjectId.Value && p.CompanyId == JaminTenantId, ct))
            return ApiResponse<JaminSiteVisitDto>.FailureResult("Selected project was not found in Jamin.");
        if (dto.PlotId.HasValue)
        {
            var plot = await _context.JaminPlots.FirstOrDefaultAsync(
                p => p.Id == dto.PlotId.Value && p.CompanyId == JaminTenantId, ct);
            if (plot == null || (dto.ProjectId.HasValue && plot.ProjectId != dto.ProjectId.Value))
                return ApiResponse<JaminSiteVisitDto>.FailureResult("Selected plot does not belong to the selected project.");
            visit.ProjectId = dto.ProjectId ?? plot.ProjectId;
            visit.PlotId = plot.Id;
        }
        else if (dto.ProjectId.HasValue) visit.ProjectId = dto.ProjectId.Value;
        if (!string.IsNullOrWhiteSpace(dto.ProjectName)) visit.ProjectName = dto.ProjectName.Trim();
        if (dto.PlotNumber != null) visit.PlotNumber = dto.PlotNumber.Trim();
        if (dto.AssignedAgentId.HasValue)
        {
            if (!await _context.Users.AnyAsync(u => u.Id == dto.AssignedAgentId.Value && u.CompanyId == JaminTenantId, ct))
                return ApiResponse<JaminSiteVisitDto>.FailureResult("Selected host does not belong to Jamin.");
            visit.AssignedAgentId = dto.AssignedAgentId.Value;
        }
        if (!string.IsNullOrWhiteSpace(dto.AssignedAgentName)) visit.AssignedAgentName = dto.AssignedAgentName.Trim();
        if (dto.LeadId.HasValue || dto.CustomerId.HasValue)
        {
            if (dto.LeadId.HasValue && dto.CustomerId.HasValue)
                return ApiResponse<JaminSiteVisitDto>.FailureResult("A site visit can be linked to either a lead or a customer, not both.");
            if (dto.LeadId is <= 0 || dto.CustomerId is <= 0)
                return ApiResponse<JaminSiteVisitDto>.FailureResult("Contact IDs must be positive.");

            if (dto.LeadId.HasValue)
            {
                var lead = await _context.Leads.FirstOrDefaultAsync(l => l.Id == dto.LeadId.Value && l.CompanyId == JaminTenantId, ct);
                if (lead == null) return ApiResponse<JaminSiteVisitDto>.FailureResult("Selected lead was not found in Jamin.");
                visit.LeadId = lead.Id;
                visit.CustomerId = null;
                visit.CustomerName = lead.Name;
                visit.CustomerPhone = lead.Phone;
                visit.ContactType = "lead";
            }
            else
            {
                var customer = await _context.Customers.FirstOrDefaultAsync(c => c.Id == dto.CustomerId!.Value && c.CompanyId == JaminTenantId, ct);
                if (customer == null) return ApiResponse<JaminSiteVisitDto>.FailureResult("Selected customer was not found in Jamin.");
                visit.CustomerId = customer.Id;
                visit.LeadId = null;
                visit.CustomerName = customer.Name;
                visit.CustomerPhone = customer.Phone;
                visit.ContactType = "customer";
            }
        }

        if (dto.VisitorNote != null) visit.VisitorNote = dto.VisitorNote.Trim();
        if (dto.OutcomeNotes != null) visit.OutcomeNotes = dto.OutcomeNotes.Trim();
        visit.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(ct);
        return ApiResponse<JaminSiteVisitDto>.SuccessResult(MapToDto(visit), "Site visit updated successfully.");
    }

    public async Task<ApiResponse<List<JaminSiteVisitDto>>> GetLeadSiteVisitsAsync(int leadId, CancellationToken ct = default)
    {
        var visits = await _context.SiteVisits
            .Where(s => s.TenantId == JaminTenantId && s.LeadId == leadId)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync(ct);

        return ApiResponse<List<JaminSiteVisitDto>>.SuccessResult(visits.Select(MapToDto).ToList());
    }

    public async Task<ApiResponse<List<JaminSiteVisitDto>>> GetCustomerSiteVisitsAsync(int customerId, CancellationToken ct = default)
    {
        var visits = await _context.SiteVisits
            .Where(s => s.TenantId == JaminTenantId && s.CustomerId == customerId)
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

