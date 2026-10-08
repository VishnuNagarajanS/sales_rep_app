using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.Followups;
using backend.DTOs.Jamin;
using backend.Models.Entities;
using backend.Models.Enums;
using backend.Services.Interfaces.Jamin;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Implementations.Jamin;

public class JaminLeadService : IJaminLeadService
{
    private readonly ApplicationDbContext _context;
    private const int JaminTenantId = 2;

    public JaminLeadService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<ApiResponse<JaminLeadDto>> ProcessWalkTheLandBookingAsync(WalkTheLandBookingDto dto, CancellationToken ct = default)
    {
        var defaultAgent = await _context.Users
            .FirstOrDefaultAsync(u => u.CompanyId == JaminTenantId && u.Role != null && u.Role.Code == "sales_executive", ct);

        int? agentId = defaultAgent?.Id;
        var agentName = defaultAgent?.Name ?? "Unassigned";

        // 1. Create Lead
        var lead = new Lead
        {
            CompanyId = JaminTenantId,
            Name = dto.Name.Trim(),
            Phone = dto.Phone.Trim(),
            Email = dto.Email?.Trim() ?? string.Empty,
            Location = dto.TargetDevelopment ?? "Tamil Nadu",
            Source = "Website - Site Visit",
            Status = "New",
            Priority = "High",
            AssignedAgentId = agentId,
            AssignedAgentName = agentName,
            TargetDevelopment = dto.TargetDevelopment,
            PreferredVisitDate = dto.PreferredVisitDate,
            PreferredTimeSlot = dto.PreferredTimeSlot,
            AnythingWeShouldKnow = dto.AnythingWeShouldKnow,
            Notes = $"Website Intake: Pick a day to walk the land. Target: {dto.TargetDevelopment}. Slot: {dto.PreferredVisitDate} ({dto.PreferredTimeSlot}). Notes: {dto.AnythingWeShouldKnow}",
            CreatedAt = DateTime.UtcNow
        };

        _context.Leads.Add(lead);
        await _context.SaveChangesAsync(ct);

        // 2. Automatically create Site Visit with status "Requested"
        var scheduledAt = !string.IsNullOrEmpty(dto.PreferredVisitDate) && !string.IsNullOrEmpty(dto.PreferredTimeSlot)
            ? $"{dto.PreferredVisitDate} • {dto.PreferredTimeSlot}"
            : (dto.PreferredVisitDate ?? "Pending Schedule");

        var siteVisit = new SiteVisit
        {
            TenantId = JaminTenantId,
            LeadId = lead.Id,
            CustomerName = lead.Name,
            CustomerPhone = lead.Phone,
            ContactType = "lead",
            ProjectName = dto.TargetDevelopment ?? "Jamin Garden — Varapatty",
            PlotNumber = "Layout Tour",
            ScheduledAt = scheduledAt,
            AssignedAgentId = agentId,
            AssignedAgentName = agentName,
            Status = "Requested",
            VisitorNote = dto.AnythingWeShouldKnow,
            OutcomeNotes = "Website site visit booking received. Needs desk confirmation call.",
            CreatedAt = DateTime.UtcNow
        };

        _context.SiteVisits.Add(siteVisit);
        await _context.SaveChangesAsync(ct);

        return ApiResponse<JaminLeadDto>.SuccessResult(MapToDto(lead), "Site visit and lead booked successfully.");
    }

    public async Task<ApiResponse<JaminLeadDto>> ProcessWebsiteMessageInquiryAsync(WebsiteMessageInquiryDto dto, CancellationToken ct = default)
    {
        var defaultAgent = await _context.Users
            .FirstOrDefaultAsync(u => u.CompanyId == JaminTenantId && u.Role != null && u.Role.Code == "sales_executive", ct);

        int? agentId = defaultAgent?.Id;
        var agentName = defaultAgent?.Name ?? "Unassigned";

        // Create Lead ONLY (No site visit created)
        var lead = new Lead
        {
            CompanyId = JaminTenantId,
            Name = dto.Name.Trim(),
            Phone = dto.Phone.Trim(),
            Email = dto.Email?.Trim() ?? string.Empty,
            Location = dto.TargetDevelopment ?? "Tamil Nadu",
            Source = "Website - Message",
            Status = "New",
            Priority = "Medium",
            AssignedAgentId = agentId,
            AssignedAgentName = agentName,
            TargetDevelopment = dto.TargetDevelopment,
            Notes = $"Website Message Inquiry: {dto.Message}",
            CreatedAt = DateTime.UtcNow
        };

        _context.Leads.Add(lead);
        await _context.SaveChangesAsync(ct);

        return ApiResponse<JaminLeadDto>.SuccessResult(MapToDto(lead), "Website message received and lead created.");
    }

    public async Task<ApiResponse<List<JaminLeadDto>>> GetJaminLeadsAsync(int? agentId = null, string? status = null, CancellationToken ct = default)
    {
        var query = _context.Leads.Where(l => l.CompanyId == JaminTenantId);

        if (agentId.HasValue && agentId.Value > 0)
        {
            query = query.Where(l => l.AssignedAgentId == agentId.Value);
        }

        if (!string.IsNullOrEmpty(status) && status != "All")
        {
            query = query.Where(l => l.Status == status);
        }

        var leads = await query.OrderByDescending(l => l.CreatedAt).ToListAsync(ct);
        return ApiResponse<List<JaminLeadDto>>.SuccessResult(leads.Select(MapToDto).ToList());
    }

    public async Task<ApiResponse<JaminLeadDto>> GetJaminLeadByIdAsync(int id, CancellationToken ct = default)
    {
        var lead = await _context.Leads.FirstOrDefaultAsync(l => l.Id == id && l.CompanyId == JaminTenantId, ct);
        if (lead == null)
        {
            return ApiResponse<JaminLeadDto>.FailureResult("Lead not found.");
        }
        return ApiResponse<JaminLeadDto>.SuccessResult(MapToDto(lead));
    }

    public async Task<ApiResponse<JaminLeadDetailDto>> GetJaminLeadDetailByIdAsync(int id, CancellationToken ct = default)
    {
        var lead = await _context.Leads.FirstOrDefaultAsync(l => l.Id == id && l.CompanyId == JaminTenantId, ct);
        if (lead == null)
        {
            return ApiResponse<JaminLeadDetailDto>.FailureResult("Lead not found.");
        }

        var siteVisits = await _context.SiteVisits
            .Where(sv => sv.TenantId == JaminTenantId && sv.LeadId == id)
            .OrderByDescending(sv => sv.CreatedAt)
            .Select(sv => new JaminSiteVisitDto
            {
                Id = sv.Id,
                TenantId = sv.TenantId,
                LeadId = sv.LeadId,
                CustomerId = sv.CustomerId,
                ProjectId = sv.ProjectId,
                PlotId = sv.PlotId,
                CustomerName = sv.CustomerName,
                CustomerPhone = sv.CustomerPhone,
                ProjectName = sv.ProjectName,
                PlotNumber = sv.PlotNumber,
                ScheduledAt = sv.ScheduledAt,
                AssignedAgentId = sv.AssignedAgentId,
                AssignedAgentName = sv.AssignedAgentName,
                Status = sv.Status,
                ContactType = sv.ContactType,
                VisitorNote = sv.VisitorNote,
                OutcomeNotes = sv.OutcomeNotes,
                CreatedAt = sv.CreatedAt
            })
            .ToListAsync(ct);

        var leadIdStr = id.ToString();
        var followups = await _context.Followups
            .Where(f => f.CompanyId == JaminTenantId && (f.ContactId == leadIdStr || f.ContactPhone == lead.Phone))
            .OrderByDescending(f => f.ScheduledAt)
            .Select(f => new FollowupResponseDto
            {
                Id = f.Id,
                CompanyId = f.CompanyId,
                ContactId = f.ContactId,
                ContactType = f.ContactType,
                ContactName = f.ContactName,
                ContactPhone = f.ContactPhone,
                ScheduledAt = f.ScheduledAt,
                Priority = f.Priority,
                Status = f.Status.ToString(),
                Notes = f.Notes,
                AssignedAgentId = f.AssignedAgentId,
                AssignedAgentName = f.AssignedToName,
                CreatedAt = f.CreatedAt
            })
            .ToListAsync(ct);

        var baseDto = MapToDto(lead);
        var detailDto = new JaminLeadDetailDto
        {
            Id = baseDto.Id,
            CompanyId = baseDto.CompanyId,
            Name = baseDto.Name,
            Phone = baseDto.Phone,
            Email = baseDto.Email,
            Location = baseDto.Location,
            Source = baseDto.Source,
            Status = baseDto.Status,
            Priority = baseDto.Priority,
            Notes = baseDto.Notes,
            AssignedAgentId = baseDto.AssignedAgentId,
            AssignedAgentName = baseDto.AssignedAgentName,
            TargetDevelopment = baseDto.TargetDevelopment,
            PreferredVisitDate = baseDto.PreferredVisitDate,
            PreferredTimeSlot = baseDto.PreferredTimeSlot,
            AnythingWeShouldKnow = baseDto.AnythingWeShouldKnow,
            BudgetRange = baseDto.BudgetRange,
            NextFollowupDate = baseDto.NextFollowupDate,
            CreatedAt = baseDto.CreatedAt,
            SiteVisits = siteVisits,
            Followups = followups
        };

        return ApiResponse<JaminLeadDetailDto>.SuccessResult(detailDto);
    }

    public async Task<ApiResponse<JaminLeadDto>> CreateLeadAsync(CreateJaminLeadDto dto, CancellationToken ct = default)
    {
        var agentId = dto.AssignedAgentId; // null = unassigned, do NOT default to user 1 (super admin)
        var agent = agentId.HasValue ? await _context.Users.FirstOrDefaultAsync(u => u.Id == agentId.Value, ct) : null;
        var agentName = agent?.Name ?? "Unassigned";

        var lead = new Lead
        {
            CompanyId = JaminTenantId,
            Name = dto.Name.Trim(),
            Phone = dto.Phone.Trim(),
            Email = dto.Email?.Trim() ?? string.Empty,
            Location = dto.Location?.Trim() ?? "Tamil Nadu",
            Source = dto.Source ?? "Direct Inbound",
            Status = "New",
            Priority = dto.Priority ?? "Medium",
            AssignedAgentId = agentId,
            AssignedAgentName = agentName,
            TargetDevelopment = dto.TargetDevelopment,
            BudgetRange = dto.BudgetRange,
            Notes = dto.Notes ?? string.Empty,
            CreatedAt = DateTime.UtcNow
        };

        _context.Leads.Add(lead);
        await _context.SaveChangesAsync(ct);

        return ApiResponse<JaminLeadDto>.SuccessResult(MapToDto(lead), "Lead created successfully.");
    }

    public async Task<ApiResponse<JaminLeadDto>> UpdateLeadAsync(int id, UpdateJaminLeadDto dto, CancellationToken ct = default)
    {
        var lead = await _context.Leads.FirstOrDefaultAsync(l => l.Id == id && l.CompanyId == JaminTenantId, ct);
        if (lead == null)
        {
            return ApiResponse<JaminLeadDto>.FailureResult("Lead not found.");
        }

        if (!string.IsNullOrWhiteSpace(dto.Name)) lead.Name = dto.Name.Trim();
        if (!string.IsNullOrWhiteSpace(dto.Phone)) lead.Phone = dto.Phone.Trim();
        if (dto.Email != null) lead.Email = dto.Email.Trim();
        if (dto.Location != null) lead.Location = dto.Location.Trim();
        if (!string.IsNullOrWhiteSpace(dto.Status)) lead.Status = dto.Status.Trim();
        if (!string.IsNullOrWhiteSpace(dto.Priority)) lead.Priority = dto.Priority.Trim();
        if (dto.TargetDevelopment != null) lead.TargetDevelopment = dto.TargetDevelopment.Trim();
        if (dto.BudgetRange != null) lead.BudgetRange = dto.BudgetRange.Trim();
        if (dto.Notes != null) lead.Notes = dto.Notes.Trim();

        if (dto.AssignedAgentId.HasValue && dto.AssignedAgentId.Value > 0)
        {
            var agent = await _context.Users.FirstOrDefaultAsync(u => u.Id == dto.AssignedAgentId.Value, ct);
            if (agent != null)
            {
                lead.AssignedAgentId = agent.Id;
                lead.AssignedAgentName = agent.Name;
            }
        }

        lead.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);

        return ApiResponse<JaminLeadDto>.SuccessResult(MapToDto(lead), "Lead updated successfully.");
    }

    public async Task<ApiResponse<bool>> AssignLeadAsync(int id, AssignJaminLeadDto dto, CancellationToken ct = default)
    {
        var lead = await _context.Leads.FirstOrDefaultAsync(l => l.Id == id && l.CompanyId == JaminTenantId, ct);
        if (lead == null)
        {
            return ApiResponse<bool>.FailureResult("Lead not found.");
        }

        var agent = await _context.Users.FirstOrDefaultAsync(u => u.Id == dto.AssignedAgentId && u.CompanyId == JaminTenantId, ct);
        if (agent == null)
        {
            return ApiResponse<bool>.FailureResult("Sales Executive not found.");
        }

        lead.AssignedAgentId = agent.Id;
        lead.AssignedAgentName = agent.Name;
        if (!string.IsNullOrWhiteSpace(dto.Notes))
        {
            lead.Notes += $"\n[Reassigned to {agent.Name}]: {dto.Notes}";
        }
        lead.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(ct);
        return ApiResponse<bool>.SuccessResult(true, $"Lead assigned to {agent.Name}.");
    }

    public async Task<ApiResponse<bool>> ScheduleFollowupAsync(int leadId, JaminScheduleFollowupDto dto, CancellationToken ct = default)
    {
        var lead = await _context.Leads.FirstOrDefaultAsync(l => l.Id == leadId && l.CompanyId == JaminTenantId, ct);
        if (lead == null)
        {
            return ApiResponse<bool>.FailureResult("Lead not found.");
        }

        lead.NextFollowupDate = dto.FollowupDate;
        lead.UpdatedAt = DateTime.UtcNow;

        var followup = new Followup
        {
            CompanyId = JaminTenantId,
            LeadId = lead.Id,
            ContactId = lead.Id.ToString(),
            ContactType = "lead",
            ContactName = lead.Name,
            ContactPhone = lead.Phone,
            ScheduledAt = dto.FollowupDate,
            Priority = "Medium",
            Status = FollowupStatus.Pending,
            Notes = dto.Notes ?? $"{dto.FollowupType ?? "call"} follow-up scheduled",
            AssignedAgentId = dto.AssignedAgentId ?? lead.AssignedAgentId,
            AssignedToName = lead.AssignedAgentName ?? "Agent",
            AssignedToRole = "sales_executive",
            CreatedAt = DateTime.UtcNow
        };

        _context.Followups.Add(followup);
        await _context.SaveChangesAsync(ct);

        return ApiResponse<bool>.SuccessResult(true, "Follow-up scheduled successfully.");
    }

    private static JaminLeadDto MapToDto(Lead l) => new()
    {
        Id = l.Id,
        CompanyId = l.CompanyId,
        Name = l.Name,
        Phone = l.Phone,
        Email = l.Email,
        Location = l.Location,
        Source = l.Source,
        Status = l.Status,
        Priority = l.Priority,
        Notes = l.Notes,
        AssignedAgentId = l.AssignedAgentId,
        AssignedAgentName = l.AssignedAgentName ?? string.Empty,
        TargetDevelopment = l.TargetDevelopment,
        PreferredVisitDate = l.PreferredVisitDate,
        PreferredTimeSlot = l.PreferredTimeSlot,
        AnythingWeShouldKnow = l.AnythingWeShouldKnow,
        BudgetRange = l.BudgetRange,
        NextFollowupDate = l.NextFollowupDate,
        CreatedAt = l.CreatedAt
    };
}
