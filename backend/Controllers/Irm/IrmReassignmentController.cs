using System.Security.Claims;
using System.Text.Json;
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
    public string? Reason { get; set; }
}

public class EndCoverageRequestDto
{
    public int CoverageId { get; set; }
}

public class ReassignIrmWorkResultDto
{
    public int CoverageId { get; set; }
    public int ReassignedLeadsCount { get; set; }
    public int ReassignedFollowupsCount { get; set; }
    public int ReassignedKycsCount { get; set; }
    public int ReassignedDealsCount { get; set; }
    public int ReassignedInvestorsCount { get; set; }
    public string FromIrmName { get; set; } = string.Empty;
    public string ToIrmName { get; set; } = string.Empty;
    public DateTime ReassignedAt { get; set; }
}

public class IrmCoverageItemDto
{
    public int Id { get; set; }
    public int OriginalIrmId { get; set; }
    public string OriginalIrmName { get; set; } = string.Empty;
    public string OriginalIrmEmail { get; set; } = string.Empty;
    public int CoveringIrmId { get; set; }
    public string CoveringIrmName { get; set; } = string.Empty;
    public string CoveringIrmEmail { get; set; } = string.Empty;
    public string ReassignedByUserName { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public DateTime StartedAt { get; set; }
    public DateTime? EndedAt { get; set; }
    public bool IsActive { get; set; }
    public int TotalRecordsCount { get; set; }
}

internal class ReassignedIdsPayload
{
    public List<int>? leadIds { get; set; }
    public List<int>? followupIds { get; set; }
    public List<int>? kycIds { get; set; }
    public List<int>? dealIds { get; set; }
    public List<int>? investorIds { get; set; }
}

[ApiController]
[Route("api/irm/admin")]
[Authorize(Roles = "company_admin,super_admin,admin")]
public class IrmReassignmentController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public IrmReassignmentController(ApplicationDbContext db)
    {
        _db = db;
    }

    [HttpGet("coverage/active")]
    public async Task<IActionResult> GetActiveCoverages(CancellationToken ct)
    {
        var role = (User.FindFirstValue(ClaimTypes.Role) ?? User.FindFirstValue("role") ?? "").ToLowerInvariant();
        var isPlatformAdmin = role == "admin" || role == "ghl_admin" || role == "super_admin";
        var companyId = User.GetCompanyId(0);
        if (companyId <= 0 && isPlatformAdmin) companyId = 1;
        if (companyId <= 0)
            return Unauthorized();

        var coverages = await _db.IrmCoverageAssignments
            .Include(c => c.OriginalIrm)
            .Include(c => c.CoveringIrm)
            .Where(c => c.CompanyId == companyId && c.IsActive)
            .OrderByDescending(c => c.StartedAt)
            .ToListAsync(ct);

        var dtos = coverages.Select(c =>
        {
            var totalCount = 0;
            try
            {
                var payload = JsonSerializer.Deserialize<ReassignedIdsPayload>(c.ReassignedRecordIdsJson);
                if (payload != null)
                {
                    totalCount = (payload.leadIds?.Count ?? 0) +
                                 (payload.followupIds?.Count ?? 0) +
                                 (payload.kycIds?.Count ?? 0) +
                                 (payload.dealIds?.Count ?? 0) +
                                 (payload.investorIds?.Count ?? 0);
                }
            }
            catch { }

            return new IrmCoverageItemDto
            {
                Id = c.Id,
                OriginalIrmId = c.OriginalIrmId,
                OriginalIrmName = c.OriginalIrm?.Name ?? $"IRM #{c.OriginalIrmId}",
                OriginalIrmEmail = c.OriginalIrm?.Email ?? string.Empty,
                CoveringIrmId = c.CoveringIrmId,
                CoveringIrmName = c.CoveringIrm?.Name ?? $"IRM #{c.CoveringIrmId}",
                CoveringIrmEmail = c.CoveringIrm?.Email ?? string.Empty,
                ReassignedByUserName = c.ReassignedByUserName,
                Reason = c.Reason,
                StartedAt = c.StartedAt,
                EndedAt = c.EndedAt,
                IsActive = c.IsActive,
                TotalRecordsCount = totalCount
            };
        }).ToList();

        return Ok(ApiResponse<List<IrmCoverageItemDto>>.SuccessResponse(dtos));
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
        var companyId = User.GetCompanyId(0);
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
        var actorId = User.GetUserId();

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

        // 6. Record Coverage Assignment for reversible history
        var coverage = new IrmCoverageAssignment
        {
            CompanyId = companyId,
            OriginalIrmId = fromUser.Id,
            CoveringIrmId = toUser.Id,
            ReassignedByUserId = actorId,
            ReassignedByUserName = actorName,
            ReassignedByUserEmail = actorEmail,
            Reason = dto.Reason ?? string.Empty,
            StartedAt = DateTime.UtcNow,
            IsActive = true,
            ReassignedRecordIdsJson = JsonSerializer.Serialize(new ReassignedIdsPayload
            {
                leadIds = openLeads.Select(l => l.Id).ToList(),
                followupIds = openFollowups.Select(f => f.Id).ToList(),
                kycIds = openKycs.Select(k => k.Id).ToList(),
                dealIds = openDeals.Select(d => d.Id).ToList(),
                investorIds = openInvestors.Select(i => i.Id).ToList()
            })
        };
        _db.IrmCoverageAssignments.Add(coverage);

        // 7. Record Audit Log
        var audit = new AuditLog
        {
            CompanyId = companyId,
            Timestamp = DateTime.UtcNow,
            ActorName = actorName,
            ActorEmail = actorEmail,
            Action = "REASSIGN_IRM_WORK",
            EntityType = "IrmCoverageAssignment",
            EntityId = toUser.Id.ToString(),
            Details = $"Reassigned open work from {fromUser.Name} (ID:{fromUser.Id}) to covering IRM {toUser.Name} (ID:{toUser.Id}). Leads: {openLeads.Count}, Follow-ups: {openFollowups.Count}, KYCs: {openKycs.Count}, Deals: {openDeals.Count}, Investors: {openInvestors.Count}. Reason: {dto.Reason ?? "Not specified"}",
            Module = "IRM_ADMIN",
            Status = "success"
        };
        _db.AuditLogs.Add(audit);

        await _db.SaveChangesAsync(ct);

        var result = new ReassignIrmWorkResultDto
        {
            CoverageId = coverage.Id,
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

    [HttpPost("coverage/end")]
    public async Task<IActionResult> EndCoverageAssignment([FromBody] EndCoverageRequestDto dto, CancellationToken ct)
    {
        if (dto.CoverageId <= 0)
            return BadRequest(ApiResponse<bool>.ErrorResponse("Valid CoverageId is required."));

        var role = (User.FindFirstValue(ClaimTypes.Role) ?? User.FindFirstValue("role") ?? "").ToLowerInvariant();
        var isPlatformAdmin = role == "admin" || role == "ghl_admin" || role == "super_admin";
        var companyId = User.GetCompanyId(0);
        if (companyId <= 0 && isPlatformAdmin) companyId = 1;
        if (companyId <= 0)
            return Unauthorized();

        var coverage = await _db.IrmCoverageAssignments
            .Include(c => c.OriginalIrm)
            .Include(c => c.CoveringIrm)
            .FirstOrDefaultAsync(c => c.Id == dto.CoverageId && c.CompanyId == companyId, ct);

        if (coverage == null)
            return NotFound(ApiResponse<bool>.ErrorResponse("Coverage assignment not found."));

        if (!coverage.IsActive)
            return BadRequest(ApiResponse<bool>.ErrorResponse("This coverage assignment is already ended."));

        var actorEmail = User.FindFirst(ClaimTypes.Email)?.Value ?? User.FindFirst("email")?.Value ?? "admin@ghl.com";
        var actorName = User.FindFirst(ClaimTypes.Name)?.Value ?? User.FindFirst("name")?.Value ?? "Administrator";

        ReassignedIdsPayload? payload = null;
        try
        {
            payload = JsonSerializer.Deserialize<ReassignedIdsPayload>(coverage.ReassignedRecordIdsJson);
        }
        catch { }

        var revertedCount = 0;

        // 1. Revert Leads still assigned to covering IRM
        if (payload?.leadIds != null && payload.leadIds.Count > 0)
        {
            var leads = await _db.Leads
                .Where(l => l.CompanyId == companyId && payload.leadIds.Contains(l.Id) && l.AssignedAgentId == coverage.CoveringIrmId)
                .ToListAsync(ct);
            foreach (var l in leads)
            {
                l.AssignedAgentId = coverage.OriginalIrmId;
                l.Notes = $"{l.Notes}\n[Coverage ended: reverted from {coverage.CoveringIrm?.Name ?? "covering IRM"} back to {coverage.OriginalIrm?.Name ?? "original IRM"} by {actorName} on {DateTime.UtcNow:yyyy-MM-dd}]";
                l.UpdatedAt = DateTime.UtcNow;
                revertedCount++;
            }
        }

        // 2. Revert Followups still assigned to covering IRM
        if (payload?.followupIds != null && payload.followupIds.Count > 0)
        {
            var followups = await _db.Followups
                .Where(f => f.CompanyId == companyId && payload.followupIds.Contains(f.Id) && f.AssignedAgentId == coverage.CoveringIrmId && f.Status == FollowupStatus.Pending)
                .ToListAsync(ct);
            foreach (var f in followups)
            {
                f.AssignedAgentId = coverage.OriginalIrmId;
                f.AssignedToId = coverage.OriginalIrmId;
                f.AssignedToName = coverage.OriginalIrm?.Name;
                f.Notes = $"{f.Notes}\n[Coverage ended: reverted back to {coverage.OriginalIrm?.Name ?? "original IRM"} by {actorName}]";
                f.UpdatedAt = DateTime.UtcNow;
                revertedCount++;
            }
        }

        // 3. Revert KYCs still assigned to covering IRM
        if (payload?.kycIds != null && payload.kycIds.Count > 0)
        {
            var kycs = await _db.InvestorKycs
                .Where(k => k.CompanyId == companyId && payload.kycIds.Contains(k.Id) && k.IrmId == coverage.CoveringIrmId)
                .ToListAsync(ct);
            foreach (var k in kycs)
            {
                k.IrmId = coverage.OriginalIrmId;
                k.UpdatedAt = DateTime.UtcNow;
                revertedCount++;
            }
        }

        // 4. Revert Deals still assigned to covering IRM
        if (payload?.dealIds != null && payload.dealIds.Count > 0)
        {
            var deals = await _db.GhlDeals
                .Where(d => d.CompanyId == companyId && payload.dealIds.Contains(d.Id) && d.AssignedAgentId == coverage.CoveringIrmId)
                .ToListAsync(ct);
            foreach (var d in deals)
            {
                d.AssignedAgentId = coverage.OriginalIrmId;
                revertedCount++;
            }
        }

        // 5. Revert Investors still assigned to covering IRM
        if (payload?.investorIds != null && payload.investorIds.Count > 0)
        {
            var investors = await _db.Investors
                .Where(i => i.CompanyId == companyId && payload.investorIds.Contains(i.Id) && i.AssignedIrmId == coverage.CoveringIrmId)
                .ToListAsync(ct);
            foreach (var i in investors)
            {
                i.AssignedIrmId = coverage.OriginalIrmId;
                i.UpdatedAt = DateTime.UtcNow;
                revertedCount++;
            }
        }

        // Mark coverage ended
        coverage.IsActive = false;
        coverage.EndedAt = DateTime.UtcNow;

        // Record Audit Log
        var audit = new AuditLog
        {
            CompanyId = companyId,
            Timestamp = DateTime.UtcNow,
            ActorName = actorName,
            ActorEmail = actorEmail,
            Action = "END_IRM_COVERAGE",
            EntityType = "IrmCoverageAssignment",
            EntityId = coverage.Id.ToString(),
            Details = $"Ended coverage assignment #{coverage.Id}. Reverted {revertedCount} active records from covering IRM {coverage.CoveringIrm?.Name} (ID:{coverage.CoveringIrmId}) back to original IRM {coverage.OriginalIrm?.Name} (ID:{coverage.OriginalIrmId}).",
            Module = "IRM_ADMIN",
            Status = "success"
        };
        _db.AuditLogs.Add(audit);

        await _db.SaveChangesAsync(ct);

        return Ok(ApiResponse<bool>.SuccessResponse(true, $"Coverage ended successfully. {revertedCount} records reverted to {coverage.OriginalIrm?.Name ?? "original IRM"}."));
    }
}
