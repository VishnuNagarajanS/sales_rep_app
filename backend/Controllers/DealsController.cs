using backend.Authentication.Interfaces;
using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.GhlDeals;
using backend.Models.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

/// <summary>
/// Unified Deals & Pipeline API.
/// Serves the Kanban board (Pipeline page) and Deals list for both GHL and Jamin Bazaar.
/// Automatically scoped by tenant (CompanyId).
/// </summary>
[ApiController]
[Route("api/deals")]
[Authorize(Roles = "sales_executive,company_admin,sales_manager,super_admin,irm")]
public class DealsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;

    public DealsController(ApplicationDbContext db, ICurrentUserService currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

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

    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResult<GhlDealResponseDto>>>> GetDeals(
        [FromQuery] string? stage,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 100,
        CancellationToken ct = default)
    {
        var query = ScopedQuery();

        if (!string.IsNullOrWhiteSpace(stage))
            query = query.Where(d => d.Stage == stage);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(d =>
                d.Title.ToLower().Contains(s) ||
                d.CustomerName.ToLower().Contains(s));
        }

        var total = await query.CountAsync(ct);
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var items = await query
            .OrderByDescending(d => d.UpdatedAt ?? d.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(d => new GhlDealResponseDto
            {
                Id = d.Id,
                CompanyId = d.CompanyId,
                Title = d.Title,
                CustomerId = d.CustomerId,
                CustomerName = d.CustomerName,
                Stage = d.Stage,
                Value = d.Value,
                Priority = d.Priority,
                AssignedAgentId = d.AssignedAgentId,
                AssignedAgentName = d.AssignedAgent != null ? d.AssignedAgent.Name : string.Empty,
                ExpectedCloseDate = d.ExpectedCloseDate,
                Notes = d.Notes,
                LostReason = d.LostReason,
                InvestorType = d.InvestorType,
                InvestmentRange = d.InvestmentRange,
                PreferredAssetClass = d.PreferredAssetClass,
                StageEnteredAt = d.StageEnteredAt,
                CreatedAt = d.CreatedAt,
                UpdatedAt = d.UpdatedAt,
            })
            .ToListAsync(ct);

        return Ok(ApiResponse<PagedResult<GhlDealResponseDto>>.SuccessResult(
            new PagedResult<GhlDealResponseDto>
            {
                Items = items,
                TotalCount = total,
                Page = page,
                PageSize = pageSize
            }));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<GhlDealResponseDto>>> CreateDeal(
        [FromBody] CreateGhlDealDto dto,
        CancellationToken ct)
    {
        var companyId = _currentUser.CompanyId ?? 1;
        var agentId = _currentUser.UserId ?? 1;

        var deal = new GhlDeal
        {
            CompanyId = companyId,
            Title = dto.Title.Trim(),
            CustomerId = dto.CustomerId,
            CustomerName = dto.CustomerName.Trim(),
            Stage = string.IsNullOrWhiteSpace(dto.Stage) ? "new" : dto.Stage.Trim(),
            Value = dto.Value,
            Priority = dto.Priority ?? "Medium",
            AssignedAgentId = agentId,
            ExpectedCloseDate = dto.ExpectedCloseDate,
            Notes = dto.Notes ?? string.Empty,
            InvestorType = dto.InvestorType,
            InvestmentRange = dto.InvestmentRange,
            PreferredAssetClass = dto.PreferredAssetClass,
            CreatedAt = DateTime.UtcNow,
        };

        _db.GhlDeals.Add(deal);
        await _db.SaveChangesAsync(ct);

        return Ok(ApiResponse<GhlDealResponseDto>.SuccessResult(new GhlDealResponseDto
        {
            Id = deal.Id,
            CompanyId = deal.CompanyId,
            Title = deal.Title,
            CustomerId = deal.CustomerId,
            CustomerName = deal.CustomerName,
            Stage = deal.Stage,
            Value = deal.Value,
            Priority = deal.Priority,
            AssignedAgentId = deal.AssignedAgentId,
            ExpectedCloseDate = deal.ExpectedCloseDate,
            Notes = deal.Notes,
            InvestorType = deal.InvestorType,
            InvestmentRange = deal.InvestmentRange,
            PreferredAssetClass = deal.PreferredAssetClass,
            CreatedAt = deal.CreatedAt,
        }, "Deal created successfully"));
    }

    [HttpPatch("{id:int}/stage")]
    public async Task<ActionResult<ApiResponse<bool>>> UpdateDealStage(
        int id,
        [FromBody] UpdateGhlDealStageDto dto,
        CancellationToken ct)
    {
        var deal = await _db.GhlDeals.FirstOrDefaultAsync(d => d.Id == id, ct);
        if (deal == null)
            return NotFound(ApiResponse<bool>.FailureResult("Deal not found"));

        deal.Stage = dto.Stage;
        deal.UpdatedAt = DateTime.UtcNow;
        if (!string.IsNullOrEmpty(dto.Reason))
            deal.Notes = (deal.Notes ?? "") + $"\n[Stage change]: {dto.Reason}";

        await _db.SaveChangesAsync(ct);
        return Ok(ApiResponse<bool>.SuccessResult(true, "Stage updated successfully"));
    }
}
