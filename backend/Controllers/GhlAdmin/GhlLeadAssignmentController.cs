using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using backend.Data;
using backend.Models.Entities;
using backend.Services;
using backend.Authentication.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers.GhlAdmin;

[ApiController]
[Route("api/ghl")]
[Authorize(Roles = "company_admin,super_admin")]
public class GhlLeadAssignmentController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;
    private readonly backend.Services.Interfaces.ICompanyClock _clock;

    public GhlLeadAssignmentController(ApplicationDbContext context, ICurrentUserService currentUserService, backend.Services.Interfaces.ICompanyClock clock)
    {
        _context = context;
        _currentUserService = currentUserService;
        _clock = clock;
    }

    private int GetCompanyId()
    {
        return _currentUserService.CompanyId
            ?? throw new UnauthorizedAccessException("Company claim is missing from token.");
    }

    private int GetCurrentUserId()
    {
        return _currentUserService.UserId ?? 0;
    }

    [HttpGet("agents")]
    public async Task<IActionResult> GetAgents(CancellationToken ct)
    {
        var companyId = GetCompanyId();
        var today = await _clock.GetCompanyTodayAsync(companyId, ct);

        var activeHandovers = await _context.WorkHandovers
            .Include(wh => wh.CoveringUser)
            .Where(wh => wh.CompanyId == companyId && wh.Status == "active")
            .ToListAsync(ct);

        var approvedLeaves = await _context.LeaveRequests
            .Where(lr => lr.CompanyId == companyId && lr.Status == "Approved" && lr.StartDate <= today && today <= lr.EndDate)
            .ToListAsync(ct);

        var agents = await _context.Users
            .Include(u => u.Role)
            .Where(u => u.CompanyId == companyId && u.Role!.Code == "sales_executive" && u.Status == backend.Models.Enums.UserStatus.Active)
            .OrderBy(u => u.Name)
            .ToListAsync(ct);

        var result = agents.Select(u =>
        {
            var handover = activeHandovers.FirstOrDefault(wh => wh.OriginalUserId == u.Id);
            var leave = approvedLeaves.FirstOrDefault(lr => lr.UserId == u.Id);
            var onLeave = leave != null;
            var isCovered = handover != null;
            var coveredBy = handover?.CoveringUser?.Name;
            var disabled = onLeave || isCovered;
            string? disabledReason = null;
            if (onLeave) disabledReason = $"On leave until {leave!.EndDate:d MMM}";
            else if (isCovered) disabledReason = $"Work covered by {coveredBy}";

            return new
            {
                id = u.Id,
                name = u.Name,
                email = u.Email,
                onLeave,
                leaveUntil = leave?.EndDate,
                isCovered,
                coveredBy,
                disabled,
                disabledReason
            };
        }).ToList();
        
        return Ok(new { success = true, data = result });
    }

    [HttpGet("workforce/availability")]
    public async Task<IActionResult> GetWorkforceAvailability([FromQuery] DateOnly? date, CancellationToken ct)
    {
        var companyId = GetCompanyId();
        var targetDate = date ?? await _clock.GetCompanyTodayAsync(companyId, ct);

        var activeHandovers = await _context.WorkHandovers
            .Include(wh => wh.CoveringUser)
            .Where(wh => wh.CompanyId == companyId && wh.Status == "active")
            .ToListAsync(ct);

        var approvedLeaves = await _context.LeaveRequests
            .Where(lr => lr.CompanyId == companyId && lr.Status == "Approved" && lr.StartDate <= targetDate && targetDate <= lr.EndDate)
            .ToListAsync(ct);

        var users = await _context.Users
            .Include(u => u.Role)
            .Where(u => u.CompanyId == companyId &&
                        u.Role != null &&
                        (u.Role.Code == "sales_executive" || u.Role.Code == "irm") &&
                        u.Status == backend.Models.Enums.UserStatus.Active)
            .OrderBy(u => u.Name)
            .ToListAsync(ct);

        var list = users.Select(u =>
        {
            var handover = activeHandovers.FirstOrDefault(wh => wh.OriginalUserId == u.Id);
            var leave = approvedLeaves.FirstOrDefault(lr => lr.UserId == u.Id);

            return new backend.DTOs.Admin.WorkforceAvailabilityDto
            {
                UserId = u.Id,
                Name = u.Name,
                RoleCode = u.Role!.Code,
                OnLeave = leave != null,
                LeaveUntil = leave?.EndDate,
                LeaveRequestId = leave?.Id,
                IsCovered = handover != null,
                CoveredBy = handover?.CoveringUser?.Name
            };
        }).ToList();

        return Ok(new { success = true, data = list });
    }

    public class AssignLeadDto
    {
        public List<int> LeadIds { get; set; } = new();
        public int AgentId { get; set; }
    }

    [HttpPost("leads/assign")]
    public async Task<IActionResult> AssignLeads([FromBody] AssignLeadDto dto, CancellationToken ct)
    {
        return await ProcessAssignmentAsync(dto.LeadIds, dto.AgentId, "manual", false, ct);
    }

    [HttpPost("leads/reassign")]
    public async Task<IActionResult> ReassignLeads([FromBody] AssignLeadDto dto, CancellationToken ct)
    {
        return await ProcessAssignmentAsync(dto.LeadIds, dto.AgentId, "manual", true, ct);
    }

    public class AutoAssignDto
    {
        public List<int>? LeadIds { get; set; }
    }

    [HttpPost("leads/auto-assign")]
    public async Task<IActionResult> AutoAssignLeads([FromBody] AutoAssignDto dto, CancellationToken ct)
    {
        var companyId = GetCompanyId();
        var callerId = GetCurrentUserId();
        var today = await _clock.GetCompanyTodayAsync(companyId, ct);

        var usersCovered = await _context.WorkHandovers
            .Where(wh => wh.CompanyId == companyId && wh.Status == "active")
            .Select(wh => wh.OriginalUserId)
            .ToListAsync(ct);

        var usersOnLeave = await _context.LeaveRequests
            .Where(lr => lr.CompanyId == companyId && lr.Status == "Approved" && lr.StartDate <= today && today <= lr.EndDate)
            .Select(lr => lr.UserId)
            .ToListAsync(ct);

        var unavailableUsers = usersCovered.Concat(usersOnLeave).Distinct().ToList();

        var agents = await _context.Users
            .Include(u => u.Role)
            .Where(u => u.CompanyId == companyId && u.Role!.Code == "sales_executive" && u.Status == backend.Models.Enums.UserStatus.Active && !unavailableUsers.Contains(u.Id))
            .OrderBy(u => u.Id)
            .Select(u => u.Id)
            .ToListAsync(ct);

        if (!agents.Any())
            return BadRequest(new { success = false, message = "No active, available sales agents found (all may be on leave or covered)." });

        List<int> targetLeadIds;
        if (dto.LeadIds != null && dto.LeadIds.Any())
        {
            targetLeadIds = dto.LeadIds;
        }
        else
        {
            targetLeadIds = await _context.Leads
                .Where(l => l.CompanyId == companyId && l.AssignedAgentId == null && l.Status != "Not Interested" && l.Status != "Junk")
                .Select(l => l.Id)
                .ToListAsync(ct);
        }

        if (!targetLeadIds.Any())
            return Ok(new { success = true, data = new { assigned = 0, skipped = new List<object>() } });

        int assignedCount = 0;
        var skipped = new List<object>();

        // We use a simple round-robin in memory, in a real system we'd persist a rotation pointer per company
        // but the prompt says "Persist a rotation pointer per company so the next batch continues from where the last stopped"
        // Let's store the rotation pointer in Tenant.Settings or just in memory for now. Wait, I will query the latest LeadAssignmentHistory to find the last assigned agent.
        
        var lastAssignment = await _context.LeadAssignmentHistories
            .Where(h => h.Lead!.CompanyId == companyId && h.Method == "auto")
            .OrderByDescending(h => h.AssignedAt)
            .FirstOrDefaultAsync(ct);

        int nextAgentIndex = 0;
        if (lastAssignment != null)
        {
            var nextAgent = agents.FirstOrDefault(id => id > lastAssignment.ToAgentId);
            if (nextAgent == 0)
                nextAgentIndex = 0;
            else
                nextAgentIndex = agents.IndexOf(nextAgent);
        }

        using var transaction = await _context.Database.BeginTransactionAsync(ct);
        
        var leads = await _context.Leads
            .Where(l => targetLeadIds.Contains(l.Id) && l.CompanyId == companyId)
            .ToListAsync(ct);
        
        foreach (var leadId in targetLeadIds)
        {
            var agentId = agents[nextAgentIndex];
            
            var lead = leads.FirstOrDefault(l => l.Id == leadId);
            if (lead == null)
            {
                skipped.Add(new { leadId, reason = "not found or access denied" });
                continue;
            }

            if (lead.AssignedAgentId != null)
            {
                skipped.Add(new { leadId, reason = "already assigned" });
                continue;
            }

            lead.AssignedAgentId = agentId;
            lead.AssignedAt = DateTime.UtcNow;
            lead.AssignedById = callerId;
            lead.UpdatedAt = DateTime.UtcNow;

            _context.LeadAssignmentHistories.Add(new LeadAssignmentHistory
            {
                LeadId = lead.Id,
                FromAgentId = null,
                ToAgentId = agentId,
                AssignedById = callerId,
                Method = "auto",
                AssignedAt = DateTime.UtcNow
            });

            assignedCount++;
            nextAgentIndex = (nextAgentIndex + 1) % agents.Count;
        }

        try
        {
            await _context.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
        }
        catch (Microsoft.EntityFrameworkCore.DbUpdateConcurrencyException)
        {
            return StatusCode(409, new { success = false, message = "Concurrency conflict occurred while updating leads. Please try again." });
        }

        return Ok(new { success = true, data = new { assigned = assignedCount, skipped } });
    }

    private async Task<IActionResult> ProcessAssignmentAsync(List<int> leadIds, int agentId, string method, bool isReassign, CancellationToken ct)
    {
        var companyId = GetCompanyId();
        var callerId = GetCurrentUserId();

        var agent = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == agentId && u.CompanyId == companyId && u.Role!.Code == "sales_executive" && u.Status == backend.Models.Enums.UserStatus.Active, ct);

        if (agent == null)
            return BadRequest(new { success = false, message = "Invalid agent." });

        var today = await _clock.GetCompanyTodayAsync(companyId, ct);

        var isCovered = await _context.WorkHandovers
            .Include(wh => wh.CoveringUser)
            .FirstOrDefaultAsync(wh => wh.CompanyId == companyId && wh.Status == "active" && wh.OriginalUserId == agentId, ct);

        var leave = await _context.LeaveRequests
            .FirstOrDefaultAsync(lr => lr.CompanyId == companyId && lr.UserId == agentId && lr.Status == "Approved" && lr.StartDate <= today && today <= lr.EndDate, ct);

        if (leave != null)
        {
            return BadRequest(new { success = false, message = $"Agent {agent.Name} is on approved leave until {leave.EndDate:d MMM}. Cannot assign new leads." });
        }

        if (isCovered != null)
        {
            return BadRequest(new { success = false, message = $"Agent {agent.Name}'s work is currently covered by {isCovered.CoveringUser?.Name ?? "another agent"}. Cannot assign new leads." });
        }

        if (leadIds == null || !leadIds.Any())
            return Ok(new { success = true, data = new { assigned = 0, skipped = new List<object>() } });

        int assignedCount = 0;
        var skipped = new List<object>();

        using var transaction = await _context.Database.BeginTransactionAsync(ct);

        foreach (var leadId in leadIds)
        {
            var lead = await _context.Leads.FirstOrDefaultAsync(l => l.Id == leadId && l.CompanyId == companyId, ct);
            if (lead == null)
            {
                skipped.Add(new { leadId, reason = "not found or access denied" });
                continue;
            }

            if (!isReassign && lead.AssignedAgentId != null)
            {
                skipped.Add(new { leadId, reason = "already assigned" });
                continue;
            }

            if (isReassign && lead.AssignedAgentId == agentId)
            {
                skipped.Add(new { leadId, reason = "already assigned to this agent" });
                continue;
            }
            
            var oldAgentId = lead.AssignedAgentId;

            lead.AssignedAgentId = agentId;
            lead.AssignedAt = DateTime.UtcNow;
            lead.AssignedById = callerId;
            lead.UpdatedAt = DateTime.UtcNow;

            _context.LeadAssignmentHistories.Add(new LeadAssignmentHistory
            {
                LeadId = lead.Id,
                FromAgentId = oldAgentId,
                ToAgentId = agentId,
                AssignedById = callerId,
                Method = method,
                AssignedAt = DateTime.UtcNow
            });

            if (lead.HandoverId.HasValue)
            {
                var handoverItem = await _context.WorkHandoverItems
                    .FirstOrDefaultAsync(i => i.HandoverId == lead.HandoverId.Value && i.EntityType == "Lead" && i.EntityId == lead.Id && i.ReturnedAt == null, ct);
                
                if (handoverItem != null)
                {
                    handoverItem.ReturnedAt = DateTime.UtcNow;
                    handoverItem.ReturnOutcome = "skipped_reassigned";
                }
                
                lead.HandoverId = null;
                lead.OriginalOwnerId = null;
            }

            if (isReassign && oldAgentId.HasValue)
            {
                var pendingFollowups = await _context.Followups
                    .Where(f => f.CompanyId == companyId && f.ContactId == lead.Id.ToString() && f.ContactType == "lead" && f.Status == backend.Models.Enums.FollowupStatus.Pending)
                    .ToListAsync(ct);
                foreach (var f in pendingFollowups)
                {
                    f.AssignedAgentId = agentId;
                    
                    if (f.HandoverId.HasValue)
                    {
                        var fHandoverItem = await _context.WorkHandoverItems
                            .FirstOrDefaultAsync(i => i.HandoverId == f.HandoverId.Value && i.EntityType == "Followup" && i.EntityId == f.Id && i.ReturnedAt == null, ct);
                        
                        if (fHandoverItem != null)
                        {
                            fHandoverItem.ReturnedAt = DateTime.UtcNow;
                            fHandoverItem.ReturnOutcome = "skipped_reassigned";
                        }
                        
                        f.HandoverId = null;
                        f.OriginalOwnerId = null;
                    }
                }
            }

            assignedCount++;
        }

        try
        {
            await _context.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Conflict(new { success = false, message = "Concurrency conflict. Some leads were modified by another user." });
        }

        return Ok(new { success = true, data = new { assigned = assignedCount, skipped } });
    }

    [HttpGet("archived-leads")]
    public async Task<IActionResult> GetArchivedLeads([FromQuery] int? agentId, [FromQuery] string? startDate, [FromQuery] string? endDate, CancellationToken ct = default)
    {
        var companyId = GetCompanyId();
        var query = _context.Leads
            .Include(l => l.AssignedAgent)
            .Where(l => l.CompanyId == companyId && (l.Status == "Junk" || l.Status == "Not Interested"));

        if (agentId.HasValue && agentId.Value > 0)
        {
            query = query.Where(l => l.AssignedAgentId == agentId.Value);
        }

        if (DateTime.TryParse(startDate, out var start))
        {
            query = query.Where(l => l.UpdatedAt >= start.ToUniversalTime());
        }
        
        if (DateTime.TryParse(endDate, out var end))
        {
            query = query.Where(l => l.UpdatedAt <= end.ToUniversalTime());
        }

        var leads = await query.OrderByDescending(l => l.UpdatedAt).ToListAsync(ct);

        var result = leads.Select(l => new
        {
            id = l.Id,
            name = l.Name,
            phone = l.Phone,
            email = l.Email,
            status = l.Status,
            source = l.Source,
            assignedAgentId = l.AssignedAgentId,
            assignedAgentName = l.AssignedAgent?.Name,
            updatedAt = l.UpdatedAt,
            notes = l.Notes
        });

        return Ok(new { success = true, data = result });
    }
}
