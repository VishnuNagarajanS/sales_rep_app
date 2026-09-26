using backend.Authentication.Interfaces;
using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.GhlDeals;
using backend.Models.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers.GhlAdmin;

/// <summary>
/// GHL India Ventures — Pipeline Deals API.
/// Serves the Kanban board (Pipeline page) and Deals list for both
/// Sales Executives (GHL stages) and IRM officers (IRM stages).
/// </summary>
[ApiController]
[Route("api/ghl/deals")]
[Authorize(Roles = "sales_executive,company_admin,sales_manager,super_admin,irm")]
public class GhlDealsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;

    public GhlDealsController(ApplicationDbContext db, ICurrentUserService currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    // ── Scoping helpers ───────────────────────────────────────────────────────

    private IQueryable<GhlDeal> ScopedQuery()
    {
        var query = _db.GhlDeals.AsNoTracking()
            .Include(d => d.AssignedAgent)
            .AsQueryable();

        var companyId = _currentUser.CompanyId;
        var role = _currentUser.Role;
        var agentId = _currentUser.UserId;

        if (companyId.HasValue)
            query = query.Where(d => d.CompanyId == companyId.Value);

        if (role == "sales_executive" && agentId.HasValue)
            query = query.Where(d => d.AssignedAgentId == agentId.Value);

        return query;
    }

    // ── GET /api/ghl/deals ────────────────────────────────────────────────────
    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResult<GhlDealResponseDto>>>> GetDeals(
        [FromQuery] string? stage,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 100,
        CancellationToken ct = default)
    {
        var query = ScopedQuery();

        if (!string.IsNullOrWhiteSpace(stage) && !stage.Equals("All", StringComparison.OrdinalIgnoreCase))
            query = query.Where(d => d.Stage == stage);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(d => d.Title.ToLower().Contains(s) || d.CustomerName.ToLower().Contains(s));
        }

        var total = await query.CountAsync(ct);
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var entities = await query
            .OrderByDescending(d => d.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var items = entities.Select(MapToDto).ToList();

        return Ok(ApiResponse<PagedResult<GhlDealResponseDto>>.SuccessResult(
            PagedResult<GhlDealResponseDto>.Create(items, total, page, pageSize),
            "GHL deals retrieved."));
    }

    // ── GET /api/ghl/deals/{id} ───────────────────────────────────────────────
    [HttpGet("{id:int}")]
    public async Task<ActionResult<ApiResponse<GhlDealResponseDto>>> GetDeal(
        int id, CancellationToken ct)
    {
        var deal = await ScopedQuery().FirstOrDefaultAsync(d => d.Id == id, ct);
        if (deal == null)
            return NotFound(ApiResponse<GhlDealResponseDto>.FailureResult("Deal not found."));

        return Ok(ApiResponse<GhlDealResponseDto>.SuccessResult(MapToDto(deal)));
    }

    // ── POST /api/ghl/deals ───────────────────────────────────────────────────
    [HttpPost]
    public async Task<ActionResult<ApiResponse<GhlDealResponseDto>>> CreateDeal(
        [FromBody] CreateGhlDealDto dto, CancellationToken ct)
    {
        var agentId = _currentUser.UserId ?? 1;
        var companyId = _currentUser.CompanyId ?? 1;

        var deal = new GhlDeal
        {
            CompanyId = companyId,
            AssignedAgentId = agentId,
            Title = dto.Title.Trim(),
            CustomerId = (dto.CustomerId.HasValue && dto.CustomerId.Value > 0) ? dto.CustomerId.Value : null,
            CustomerName = dto.CustomerName.Trim(),
            Stage = string.IsNullOrWhiteSpace(dto.Stage) ? "new" : dto.Stage.Trim(),
            Value = dto.Value,
            ExpectedCloseDate = dto.ExpectedCloseDate.Trim(),
            Notes = dto.Notes.Trim(),
            InvestorType = dto.InvestorType,
            InvestmentRange = dto.InvestmentRange,
            PreferredAssetClass = dto.PreferredAssetClass,
            Priority = string.IsNullOrWhiteSpace(dto.Priority) ? "Medium" : dto.Priority.Trim(),
            StageEnteredAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
        };

        _db.GhlDeals.Add(deal);
        await _db.SaveChangesAsync(ct);
        await _db.Entry(deal).Reference(d => d.AssignedAgent).LoadAsync(ct);

        return CreatedAtAction(nameof(GetDeal), new { id = deal.Id },
            ApiResponse<GhlDealResponseDto>.SuccessResult(MapToDto(deal), "Deal created."));
    }

    // ── PUT /api/ghl/deals/{id} ───────────────────────────────────────────────
    [HttpPut("{id:int}")]
    public async Task<ActionResult<ApiResponse<GhlDealResponseDto>>> UpdateDeal(
        int id, [FromBody] UpdateGhlDealDto dto, CancellationToken ct)
    {
        var deal = await _db.GhlDeals
            .Include(d => d.AssignedAgent)
            .FirstOrDefaultAsync(d => d.Id == id && d.CompanyId == _currentUser.CompanyId, ct);

        if (deal == null)
            return NotFound(ApiResponse<GhlDealResponseDto>.FailureResult("Deal not found."));

        if (dto.Title != null) deal.Title = dto.Title.Trim();
        if (dto.Stage != null) deal.Stage = dto.Stage.Trim();
        if (dto.Value.HasValue) deal.Value = dto.Value.Value;
        if (dto.ExpectedCloseDate != null) deal.ExpectedCloseDate = dto.ExpectedCloseDate.Trim();
        if (dto.Notes != null) deal.Notes = dto.Notes.Trim();
        if (dto.LostReason != null) deal.LostReason = dto.LostReason.Trim();
        if (dto.InvestorType != null) deal.InvestorType = dto.InvestorType;
        if (dto.InvestmentRange != null) deal.InvestmentRange = dto.InvestmentRange;
        if (dto.PreferredAssetClass != null) deal.PreferredAssetClass = dto.PreferredAssetClass;
        if (dto.Priority != null) deal.Priority = dto.Priority.Trim();
        if (dto.StageEnteredAt.HasValue) deal.StageEnteredAt = dto.StageEnteredAt.Value;

        deal.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(ApiResponse<GhlDealResponseDto>.SuccessResult(MapToDto(deal), "Deal updated."));
    }

    // ── DELETE /api/ghl/deals/{id} ────────────────────────────────────────────
    [HttpDelete("{id:int}")]
    [Authorize(Roles = "company_admin,super_admin")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteDeal(int id, CancellationToken ct)
    {
        var deal = await _db.GhlDeals
            .FirstOrDefaultAsync(d => d.Id == id && d.CompanyId == _currentUser.CompanyId, ct);

        if (deal == null)
            return NotFound(ApiResponse<bool>.FailureResult("Deal not found."));

        _db.GhlDeals.Remove(deal);
        await _db.SaveChangesAsync(ct);

        return Ok(ApiResponse<bool>.SuccessResult(true, "Deal deleted."));
    }

    // ── GET /api/ghl/deals/{id}/activities ───────────────────────────────────
    [HttpGet("{id:int}/activities")]
    public async Task<ActionResult<ApiResponse<List<GhlDealActivityResponseDto>>>> GetActivities(
        int id, CancellationToken ct)
    {
        var activities = await _db.GhlDealActivities
            .AsNoTracking()
            .Where(a => a.DealId == id && a.CompanyId == _currentUser.CompanyId)
            .OrderBy(a => a.Timestamp)
            .Select(a => new GhlDealActivityResponseDto
            {
                Id = a.Id,
                DealId = a.DealId,
                CompanyId = a.CompanyId,
                Type = a.Type,
                Text = a.Text,
                FromStage = a.FromStage,
                ToStage = a.ToStage,
                LoggedByName = a.LoggedByName,
                LoggedByRole = a.LoggedByRole,
                Timestamp = a.Timestamp,
                CreatedAt = a.CreatedAt,
            })
            .ToListAsync(ct);

        return Ok(ApiResponse<List<GhlDealActivityResponseDto>>.SuccessResult(activities));
    }

    // ── POST /api/ghl/deals/{id}/activities ──────────────────────────────────
    [HttpPost("{id:int}/activities")]
    public async Task<ActionResult<ApiResponse<GhlDealActivityResponseDto>>> LogActivity(
        int id, [FromBody] LogGhlDealActivityDto dto, CancellationToken ct)
    {
        // Verify deal belongs to this company
        var dealExists = await _db.GhlDeals
            .AnyAsync(d => d.Id == id && d.CompanyId == _currentUser.CompanyId, ct);

        if (!dealExists)
            return NotFound(ApiResponse<GhlDealActivityResponseDto>.FailureResult("Deal not found."));

        var activity = new GhlDealActivity
        {
            DealId = id,
            CompanyId = _currentUser.CompanyId ?? 1,
            Type = dto.Type.Trim(),
            Text = dto.Text.Trim(),
            FromStage = dto.FromStage,
            ToStage = dto.ToStage,
            LoggedByName = dto.LoggedByName.Trim(),
            LoggedByRole = dto.LoggedByRole.Trim(),
            Timestamp = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
        };

        _db.GhlDealActivities.Add(activity);
        await _db.SaveChangesAsync(ct);

        var response = new GhlDealActivityResponseDto
        {
            Id = activity.Id,
            DealId = activity.DealId,
            CompanyId = activity.CompanyId,
            Type = activity.Type,
            Text = activity.Text,
            FromStage = activity.FromStage,
            ToStage = activity.ToStage,
            LoggedByName = activity.LoggedByName,
            LoggedByRole = activity.LoggedByRole,
            Timestamp = activity.Timestamp,
            CreatedAt = activity.CreatedAt,
        };

        return Ok(ApiResponse<GhlDealActivityResponseDto>.SuccessResult(response, "Activity logged."));
    }

    // ── Mapper ────────────────────────────────────────────────────────────────
    private static GhlDealResponseDto MapToDto(GhlDeal d) => new()
    {
        Id = d.Id,
        CompanyId = d.CompanyId,
        AssignedAgentId = d.AssignedAgentId,
        AssignedAgentName = d.AssignedAgent?.Name,
        Title = d.Title,
        CustomerId = d.CustomerId,
        CustomerName = d.CustomerName,
        Stage = d.Stage,
        Value = d.Value,
        ExpectedCloseDate = d.ExpectedCloseDate,
        Notes = d.Notes,
        LostReason = d.LostReason,
        InvestorType = d.InvestorType,
        InvestmentRange = d.InvestmentRange,
        PreferredAssetClass = d.PreferredAssetClass,
        Priority = d.Priority,
        StageEnteredAt = d.StageEnteredAt,
        CreatedAt = d.CreatedAt,
        UpdatedAt = d.UpdatedAt,
    };
}
