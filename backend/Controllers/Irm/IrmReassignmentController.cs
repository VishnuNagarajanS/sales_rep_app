using System.Security.Claims;
using backend.Data;
using backend.DTOs.Common;
using backend.Extensions;
using backend.Models.Entities;
using backend.Models.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers.Irm;

public class ReassignIrmWorkRequestDto
{
    public int FromIrmId { get; set; }
    public int ToIrmId { get; set; }
    public int? CompanyId { get; set; }
    public string? Reason { get; set; }
}

public class ReassignIrmWorkResultDto
{
    public int ReassignedLeadsCount { get; set; }
    public int ReassignedFollowupsCount { get; set; }
    public int ReassignedKycsCount { get; set; }
    public int ReassignedDealsCount { get; set; }
    public int ReassignedInvestorsCount { get; set; }
    public string FromIrmName { get; set; } = string.Empty;
    public string ToIrmName { get; set; } = string.Empty;
    public DateTime ReassignedAt { get; set; }
}

[ApiController]
[Route("api/irm/admin")]
[Authorize(Roles = "company_admin,super_admin,sales_manager,admin")]
public class IrmReassignmentController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public IrmReassignmentController(ApplicationDbContext db)
    {
        _db = db;
    }

    [HttpPost("reassign")]
    public async Task<IActionResult> ReassignIrmWork([FromBody] ReassignIrmWorkRequestDto dto, CancellationToken ct)
    {
        if (dto.FromIrmId <= 0 || dto.ToIrmId <= 0)
            return BadRequest(ApiResponse<ReassignIrmWorkResultDto>.ErrorResponse("Valid FromIrmId and ToIrmId are required."));

        if (dto.FromIrmId == dto.ToIrmId)
            return BadRequest(ApiResponse<ReassignIrmWorkResultDto>.ErrorResponse("Cannot reassign work to the same IRM."));

        var role = (User.FindFirstValue(ClaimTypes.Role) ?? User.FindFirstValue("role") ?? "").ToLowerInvariant();
        var isPlatformAdmin = role == "admin" || role == "ghl_admin" || role == "super_admin";
        var companyId = dto.CompanyId ?? User.GetCompanyId(0);
        if (companyId <= 0 && isPlatformAdmin) companyId = 1;
        if (companyId <= 0)
            return Unauthorized();

        var fromUser = await _db.Users.FirstOrDefaultAsync(u => u.Id == dto.FromIrmId && u.CompanyId == companyId, ct);
        if (fromUser == null)
            return NotFound(ApiResponse<ReassignIrmWorkResultDto>.ErrorResponse($"Source IRM with ID {dto.FromIrmId} not found in this company."));

        var toUser = await _db.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.Id == dto.ToIrmId && u.CompanyId == companyId, ct);
        if (toUser == null)
            return NotFound(ApiResponse<ReassignIrmWorkResultDto>.ErrorResponse($"Destination IRM with ID {dto.ToIrmId} not found in this company."));

        // Inactive IRMs must not receive new assignments
        if (toUser.Status != UserStatus.Active)
            return BadRequest(ApiResponse<ReassignIrmWorkResultDto>.ErrorResponse($"Target IRM '{toUser.Name}' is inactive ({toUser.Status}) and cannot receive assignments."));

        var actorEmail = User.FindFirst(ClaimTypes.Email)?.Value ?? User.FindFirst("email")?.Value ?? "admin@ghl.com";
        var actorName = User.FindFirst(ClaimTypes.Name)?.Value ?? User.FindFirst("name")?.Value ?? "Administrator";

        // 1. Reassign open leads
        var openLeads = await _db.Leads
            .Where(l => l.CompanyId == companyId && l.AssignedAgentId == dto.FromIrmId &&
                        l.Status != "Converted" && l.Status != "Not Interested" && l.Status != "Junk")
            .ToListAsync(ct);
        foreach (var l in openLeads)
        {
            l.AssignedAgentId = toUser.Id;
            l.Notes = $"{l.Notes}\n[Reassigned from {fromUser.Name} to {toUser.Name} by {actorName} on {DateTime.UtcNow:yyyy-MM-dd}]";
            l.UpdatedAt = DateTime.UtcNow;
        }

        // 2. Reassign open follow-ups (preserve completed history)
        var openFollowups = await _db.Followups
            .Where(f => f.CompanyId == companyId && f.AssignedAgentId == dto.FromIrmId && f.Status == FollowupStatus.Pending)
            .ToListAsync(ct);
        foreach (var f in openFollowups)
        {
            f.AssignedAgentId = toUser.Id;
            f.AssignedToId = toUser.Id;
            f.AssignedToName = toUser.Name;
            f.Notes = $"{f.Notes}\n[Reassigned to {toUser.Name} by {actorName}]";
            f.UpdatedAt = DateTime.UtcNow;
        }

        // 3. Reassign open KYC requests (preserve completed/approved history)
        var openKycs = await _db.InvestorKycs
            .Where(k => k.CompanyId == companyId && k.IrmId == dto.FromIrmId &&
                        k.Status != KycStatus.Approved && k.Status != KycStatus.Rejected)
            .ToListAsync(ct);
        foreach (var k in openKycs)
        {
            k.IrmId = toUser.Id;
            k.UpdatedAt = DateTime.UtcNow;
        }

        // 4. Reassign open GhlDeals
        var openDeals = await _db.GhlDeals
            .Where(d => d.CompanyId == companyId && d.AssignedAgentId == dto.FromIrmId &&
                        d.Stage != "won" && d.Stage != "lost" && d.Stage != "converted")
            .ToListAsync(ct);
        foreach (var d in openDeals)
        {
            d.AssignedAgentId = toUser.Id;
        }

        // 5. Reassign Investors
        var openInvestors = await _db.Investors
            .Where(i => i.CompanyId == companyId && i.AssignedIrmId == dto.FromIrmId)
            .ToListAsync(ct);
        foreach (var i in openInvestors)
        {
            i.AssignedIrmId = toUser.Id;
            i.UpdatedAt = DateTime.UtcNow;
        }

        // 6. Record Audit Log
        var audit = new AuditLog
        {
            CompanyId = companyId,
            Timestamp = DateTime.UtcNow,
            ActorName = actorName,
            ActorEmail = actorEmail,
            Action = "REASSIGN_IRM_WORK",
            EntityType = "User",
            EntityId = dto.ToIrmId.ToString(),
            Details = $"Reassigned open work from {fromUser.Name} (ID:{fromUser.Id}) to {toUser.Name} (ID:{toUser.Id}). Leads: {openLeads.Count}, Follow-ups: {openFollowups.Count}, KYCs: {openKycs.Count}, Deals: {openDeals.Count}, Investors: {openInvestors.Count}. Reason: {dto.Reason ?? "Not specified"}",
            Module = "IRM_ADMIN",
            Status = "success"
        };
        _db.AuditLogs.Add(audit);

        await _db.SaveChangesAsync(ct);

        var result = new ReassignIrmWorkResultDto
        {
            ReassignedLeadsCount = openLeads.Count,
            ReassignedFollowupsCount = openFollowups.Count,
            ReassignedKycsCount = openKycs.Count,
            ReassignedDealsCount = openDeals.Count,
            ReassignedInvestorsCount = openInvestors.Count,
            FromIrmName = fromUser.Name,
            ToIrmName = toUser.Name,
            ReassignedAt = DateTime.UtcNow
        };

        return Ok(ApiResponse<ReassignIrmWorkResultDto>.SuccessResponse(result, "Work reassigned successfully."));
    }
}
