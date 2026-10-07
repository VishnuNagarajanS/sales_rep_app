using backend.Authentication.Interfaces;
using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.GhlOpportunities;
using backend.Extensions;
using backend.Models.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using backend.Services.Interfaces;
using backend.Services.Implementations;

namespace backend.Controllers.GhlAdmin;

/// <summary>
/// GHL India Ventures — Investment Opportunity Pipeline API.
/// Tracks AIF / CO-AIF fund investment opportunities per investor.
/// Stages: Enquiry → Contacted → Consultation → Qualified → Opportunity → Committed → Closed Won/Lost.
/// </summary>
[ApiController]
[Route("api/ghl/investment-opportunities")]
[Authorize(Roles = "sales_executive,company_admin,super_admin,irm")]
public class GhlOpportunitiesController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IIrmOtherService _otherService;

    public GhlOpportunitiesController(ApplicationDbContext db, ICurrentUserService currentUser, IIrmOtherService? otherService = null)
    {
        _db = db;
        _currentUser = currentUser;
        _otherService = otherService ?? new IrmOtherService(db);
    }

    private IQueryable<GhlInvestmentOpportunity> ScopedQuery()
    {
        var query = _db.GhlInvestmentOpportunities.AsNoTracking()
            .Include(o => o.AssignedAgent)
            .Include(o => o.Investor)
            .AsQueryable();

        var companyId = _currentUser.CompanyId;
        var role = _currentUser.Role;
        var agentId = _currentUser.UserId;

        if (companyId.HasValue)
            query = query.Where(o => o.CompanyId == companyId.Value);

        if (role == "sales_executive" && agentId.HasValue)
            query = query.Where(o => o.AssignedAgentId == agentId.Value);

        return query;
    }

    // ── GET /api/ghl/investment-opportunities ─────────────────────────────────
    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResult<GhlOpportunityResponseDto>>>> GetOpportunities(
        [FromQuery] string? stage,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 100,
        CancellationToken ct = default)
    {
        var query = ScopedQuery();

        if (!string.IsNullOrWhiteSpace(stage) && !stage.Equals("All", StringComparison.OrdinalIgnoreCase))
            query = query.Where(o => o.Stage == stage);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(o =>
                o.Title.ToLower().Contains(s) ||
                (o.Investor != null && o.Investor.Name.ToLower().Contains(s)));
        }

        var companyId = _currentUser.CompanyId ?? 1;
        var otherMatcher = await _otherService.GetOtherMatcherAsync(companyId, "opportunities", ct);

        var entities = await query
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync(ct);

        if (otherMatcher.HasAnyOther)
        {
            entities = entities
                .Where(o => !otherMatcher.IsInOther(o.Investor?.Phone, o.InvestorId, null, o.Investor?.Name ?? o.Title))
                .ToList();
        }

        var total = entities.Count;
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var paged = entities
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        var items = paged.Select(MapToDto).ToList();

        return Ok(ApiResponse<PagedResult<GhlOpportunityResponseDto>>.SuccessResult(
            PagedResult<GhlOpportunityResponseDto>.Create(items, total, page, pageSize),
            "Investment opportunities retrieved."));
    }

    // ── GET /api/ghl/investment-opportunities/{id} ────────────────────────────
    [HttpGet("{id:int}")]
    public async Task<ActionResult<ApiResponse<GhlOpportunityResponseDto>>> GetOpportunity(
        int id, CancellationToken ct)
    {
        var opp = await ScopedQuery().FirstOrDefaultAsync(o => o.Id == id, ct);
        if (opp == null)
            return NotFound(ApiResponse<GhlOpportunityResponseDto>.FailureResult("Opportunity not found."));

        return Ok(ApiResponse<GhlOpportunityResponseDto>.SuccessResult(MapToDto(opp)));
    }

    // ── POST /api/ghl/investment-opportunities ────────────────────────────────
    [HttpPost]
    public async Task<ActionResult<ApiResponse<GhlOpportunityResponseDto>>> CreateOpportunity(
        [FromBody] CreateGhlOpportunityDto dto, CancellationToken ct)
    {
        if (User.IsGhlAdmin())
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<GhlOpportunityResponseDto>.FailureResult("Access denied: GHL Admin has read-only access to IRM investment opportunity data."));
        }

        var agentId = _currentUser.UserId;
        if (!agentId.HasValue || agentId.Value <= 0)
            return Unauthorized(ApiResponse<GhlOpportunityResponseDto>.FailureResult("Unauthorized: User ID is missing."));

        var companyId = _currentUser.CompanyId;
        if (!companyId.HasValue || companyId.Value <= 0)
            return Unauthorized(ApiResponse<GhlOpportunityResponseDto>.FailureResult("Unauthorized: Company ID is missing."));

        // Verify investor exists
        var investorExists = await _db.Investors
            .AnyAsync(i => i.Id == dto.InvestorId && i.CompanyId == companyId.Value, ct);

        if (!investorExists)
            return BadRequest(ApiResponse<GhlOpportunityResponseDto>.FailureResult("Investor not found."));

        var opp = new GhlInvestmentOpportunity
        {
            CompanyId = companyId.Value,
            InvestorId = dto.InvestorId,
            AssignedAgentId = agentId.Value,
            Title = dto.Title.Trim(),
            Stage = string.IsNullOrWhiteSpace(dto.Stage) ? "Enquiry" : dto.Stage.Trim(),
            TargetAmount = dto.TargetAmount,
            CommittedAmount = dto.CommittedAmount,
            ExpectedCloseDate = dto.ExpectedCloseDate.Trim(),
            Notes = dto.Notes.Trim(),
            CreatedAt = DateTime.UtcNow,
        };

        _db.GhlInvestmentOpportunities.Add(opp);
        await _db.SaveChangesAsync(ct);

        await _db.Entry(opp).Reference(o => o.AssignedAgent).LoadAsync(ct);
        await _db.Entry(opp).Reference(o => o.Investor).LoadAsync(ct);

        return CreatedAtAction(nameof(GetOpportunity), new { id = opp.Id },
            ApiResponse<GhlOpportunityResponseDto>.SuccessResult(MapToDto(opp), "Opportunity created."));
    }

    // ── PUT /api/ghl/investment-opportunities/{id} ────────────────────────────
    [HttpPut("{id:int}")]
    public async Task<ActionResult<ApiResponse<GhlOpportunityResponseDto>>> UpdateOpportunity(
        int id, [FromBody] UpdateGhlOpportunityDto dto, CancellationToken ct)
    {
        if (User.IsGhlAdmin())
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<GhlOpportunityResponseDto>.FailureResult("Access denied: GHL Admin has read-only access to IRM investment opportunity data."));
        }

        var opp = await _db.GhlInvestmentOpportunities
            .Include(o => o.AssignedAgent)
            .Include(o => o.Investor)
            .FirstOrDefaultAsync(o => o.Id == id && o.CompanyId == _currentUser.CompanyId, ct);

        if (opp == null)
            return NotFound(ApiResponse<GhlOpportunityResponseDto>.FailureResult("Opportunity not found."));

        if (dto.Title != null) opp.Title = dto.Title.Trim();
        if (dto.Stage != null) opp.Stage = dto.Stage.Trim();
        if (dto.TargetAmount.HasValue) opp.TargetAmount = dto.TargetAmount.Value;
        if (dto.CommittedAmount.HasValue) opp.CommittedAmount = dto.CommittedAmount.Value;
        if (dto.ExpectedCloseDate != null) opp.ExpectedCloseDate = dto.ExpectedCloseDate.Trim();
        if (dto.Notes != null) opp.Notes = dto.Notes.Trim();

        opp.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(ApiResponse<GhlOpportunityResponseDto>.SuccessResult(MapToDto(opp), "Opportunity updated."));
    }

    // ── DELETE /api/ghl/investment-opportunities/{id} ─────────────────────────
    [HttpDelete("{id:int}")]
    [Authorize(Roles = "company_admin,super_admin,irm")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteOpportunity(int id, CancellationToken ct)
    {
        if (User.IsGhlAdmin())
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<bool>.FailureResult("Access denied: GHL Admin has read-only access to IRM investment opportunity data."));
        }

        var opp = await _db.GhlInvestmentOpportunities
            .FirstOrDefaultAsync(o => o.Id == id && o.CompanyId == _currentUser.CompanyId, ct);

        if (opp == null)
            return NotFound(ApiResponse<bool>.FailureResult("Opportunity not found."));

        _db.GhlInvestmentOpportunities.Remove(opp);
        await _db.SaveChangesAsync(ct);

        return Ok(ApiResponse<bool>.SuccessResult(true, "Opportunity deleted."));
    }

    private static GhlOpportunityResponseDto MapToDto(GhlInvestmentOpportunity o) => new()
    {
        Id = o.Id,
        CompanyId = o.CompanyId,
        InvestorId = o.InvestorId,
        InvestorName = o.Investor?.Name ?? string.Empty,
        AssignedAgentId = o.AssignedAgentId,
        AssignedAgentName = o.AssignedAgent?.Name,
        Title = o.Title,
        Stage = o.Stage,
        TargetAmount = o.TargetAmount,
        CommittedAmount = o.CommittedAmount,
        ExpectedCloseDate = o.ExpectedCloseDate,
        Notes = o.Notes,
        CreatedAt = o.CreatedAt,
        UpdatedAt = o.UpdatedAt,
    };
}
