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

    public GhlLeadAssignmentController(ApplicationDbContext context, ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    private int GetCompanyId()
    {
        return _currentUserService.CompanyId ?? 1; // fallback
    }

    private int GetCurrentUserId()
    {
        return _currentUserService.UserId ?? 0;
    }

    [HttpGet("agents")]
    public async Task<IActionResult> GetAgents(CancellationToken ct)
    {
        var companyId = GetCompanyId();
        var agents = await _context.Users
            .Include(u => u.Role)
            .Where(u => u.CompanyId == companyId && u.Role!.Code == "sales_executive" && u.Status == backend.Models.Enums.UserStatus.Active)
            .Select(u => new { id = u.Id, name = u.Name, email = u.Email })
            .ToListAsync(ct);
        
        return Ok(new { success = true, data = agents });
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

        var agents = await _context.Users
            .Include(u => u.Role)
            .Where(u => u.CompanyId == companyId && u.Role!.Code == "sales_executive" && u.Status == backend.Models.Enums.UserStatus.Active)
            .OrderBy(u => u.Id)
            .Select(u => u.Id)
            .ToListAsync(ct);

        if (!agents.Any())
            return BadRequest(new { success = false, message = "No active sales agents found." });

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
            var idx = agents.IndexOf(lastAssignment.ToAgentId);
            if (idx >= 0)
                nextAgentIndex = (idx + 1) % agents.Count;
        }

        using var transaction = await _context.Database.BeginTransactionAsync(ct);
        
        foreach (var leadId in targetLeadIds)
        {
            var agentId = agents[nextAgentIndex];
            
            var lead = await _context.Leads.FirstOrDefaultAsync(l => l.Id == leadId && l.CompanyId == companyId, ct);
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

        await _context.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

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

            if (isReassign && oldAgentId.HasValue)
            {
                var pendingFollowups = await _context.Followups
                    .Where(f => f.ContactId == lead.Id.ToString() && f.ContactType == "lead" && f.Status == backend.Models.Enums.FollowupStatus.Pending)
                    .ToListAsync(ct);
                foreach (var f in pendingFollowups)
                {
                    f.AssignedAgentId = agentId;
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
}
