using backend.Authentication.Interfaces;
using backend.Helpers;
using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.GhlDeals;
using backend.Extensions;
using backend.Models.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using backend.Services.Interfaces;
using backend.Services.Implementations;

namespace backend.Controllers.GhlAdmin;

/// <summary>
/// GHL India Ventures — Pipeline Deals API.
/// Serves the Kanban board (Pipeline page) and Deals list for both
/// Sales Executives (GHL stages) and IRM officers (IRM stages).
/// </summary>
[ApiController]
[Route("api/ghl/deals")]
[Authorize(Roles = "sales_executive,company_admin,super_admin,irm")]
public class GhlDealsController : ControllerBase
{
    private static readonly HashSet<string> IrmStages = new(StringComparer.OrdinalIgnoreCase)
    {
        "leads", "followup", "qualified_investor", "investment_opportunity", "converted"
    };

    private readonly ApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IIrmOtherService _otherService;

    public GhlDealsController(ApplicationDbContext db, ICurrentUserService currentUser, IIrmOtherService? otherService = null)
    {
        _db = db;
        _currentUser = currentUser;
        _otherService = otherService ?? new IrmOtherService(db);
    }

    private static bool IsIrmDeal(GhlDeal deal)
    {
        if (deal.AssignedAgent?.Role != null &&
            (deal.AssignedAgent.Role.Code.Equals("irm", StringComparison.OrdinalIgnoreCase) ||
             deal.AssignedAgent.Role.Name.Equals("IRM", StringComparison.OrdinalIgnoreCase)))
        {
            return true;
        }

        if (!string.IsNullOrWhiteSpace(deal.Stage) && IrmStages.Contains(deal.Stage.Trim()))
        {
            return true;
        }

        return false;
    }

    // ── Scoping helpers ───────────────────────────────────────────────────────

    private IQueryable<GhlDeal> ScopedQuery()
    {
        var query = _db.GhlDeals.AsNoTracking()
            .Include(d => d.AssignedAgent)
            .Include(d => d.Customer)   // needed to resolve Phone / Email / Location
            .AsQueryable();

        var companyId = _currentUser.CompanyId;
        var role = _currentUser.Role;
        var agentId = _currentUser.UserId;

        if (companyId.HasValue)
            query = query.Where(d => d.CompanyId == companyId.Value);

        if ((role == "sales_executive" || role == "irm") && agentId.HasValue)
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

        var companyId = _currentUser.CompanyId ?? 1;
        string? moduleForStage = (stage?.Trim().ToLowerInvariant()) switch
        {
            "qualified_investor" => "kyc",
            "investment_opportunity" => "opportunities",
            "followup" => "follow_up",
            "leads" => "my_leads",
            _ => null
        };
        var otherMatcher = await _otherService.GetOtherMatcherAsync(companyId, moduleForStage, ct);

        var entities = await query
            .OrderByDescending(d => d.CreatedAt)
            .ToListAsync(ct);

        if (otherMatcher.HasAnyOther)
        {
            entities = entities
                .Where(d => !otherMatcher.IsInOther(d.Customer?.Phone, d.CustomerId, null, d.CustomerName))
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
        await PopulateContactDetailsAsync(items, paged, ct);

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

        var dto = MapToDto(deal);
        await PopulateContactDetailsAsync(new List<GhlDealResponseDto> { dto }, new List<GhlDeal> { deal }, ct);

        return Ok(ApiResponse<GhlDealResponseDto>.SuccessResult(dto));
    }

    // ── POST /api/ghl/deals ───────────────────────────────────────────────────
    [HttpPost]
    public async Task<ActionResult<ApiResponse<GhlDealResponseDto>>> CreateDeal(
        [FromBody] CreateGhlDealDto dto, CancellationToken ct)
    {
        if (User.IsGhlAdmin() && !string.IsNullOrWhiteSpace(dto.Stage) && IrmStages.Contains(dto.Stage.Trim()))
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<GhlDealResponseDto>.FailureResult("Access denied: GHL Admin has read-only access to IRM deal data."));
        }

        var role = _currentUser.Role?.ToLowerInvariant();
        if (role == "irm" && (string.IsNullOrWhiteSpace(dto.Stage) || !IrmStages.Contains(dto.Stage.Trim())))
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<GhlDealResponseDto>.FailureResult("Access denied: IRM users cannot create deals directly outside IRM stages."));
        }

        var agentId = _currentUser.UserId;
        if (!agentId.HasValue || agentId.Value <= 0)
            return Unauthorized(ApiResponse<GhlDealResponseDto>.FailureResult("Unauthorized: User ID is missing."));

        var companyId = _currentUser.CompanyId;
        if (!companyId.HasValue || companyId.Value <= 0)
            return Unauthorized(ApiResponse<GhlDealResponseDto>.FailureResult("Unauthorized: Company ID is missing."));

        // Deduplication & canonical deal reuse:
        // If a deal already exists for this customer in this company, update it instead of creating duplicates
        GhlDeal? existingDeal = null;
        if (dto.CustomerId.HasValue && dto.CustomerId.Value > 0)
        {
            existingDeal = await _db.GhlDeals
                .Include(d => d.AssignedAgent)
                .ThenInclude(a => a.Role)
                .FirstOrDefaultAsync(d =>
                    d.CompanyId == companyId.Value &&
                    d.CustomerId == dto.CustomerId.Value, ct);
        }
        if (existingDeal == null && !string.IsNullOrWhiteSpace(dto.CustomerName))
        {
            var custNameLower = dto.CustomerName.Trim().ToLower();
            existingDeal = await _db.GhlDeals
                .Include(d => d.AssignedAgent)
                .ThenInclude(a => a.Role)
                .FirstOrDefaultAsync(d =>
                    d.CompanyId == companyId.Value &&
                    d.CustomerName.ToLower() == custNameLower, ct);
        }

        if (existingDeal != null)
        {
            if (IsIrmDeal(existingDeal) && User.IsGhlAdmin())
            {
                return StatusCode(StatusCodes.Status403Forbidden,
                    ApiResponse<GhlDealResponseDto>.FailureResult("Access denied: GHL Admin has read-only access to IRM deal data."));
            }

            existingDeal.Stage = string.IsNullOrWhiteSpace(dto.Stage) ? existingDeal.Stage : dto.Stage.Trim();
            if (dto.Value > 0) existingDeal.Value = dto.Value;
            if (!string.IsNullOrWhiteSpace(dto.Notes)) existingDeal.Notes = dto.Notes.Trim();
            if (dto.InvestmentRange != null) existingDeal.InvestmentRange = OptionalFieldNormalizer.Normalize(dto.InvestmentRange);
            if (dto.PreferredAssetClass != null) existingDeal.PreferredAssetClass = OptionalFieldNormalizer.Normalize(dto.PreferredAssetClass);
            if (agentId.HasValue && agentId.Value > 0) existingDeal.AssignedAgentId = agentId.Value;
            existingDeal.StageEnteredAt = DateTime.UtcNow;

            await _db.SaveChangesAsync(ct);
            await _db.Entry(existingDeal).Reference(d => d.AssignedAgent).LoadAsync(ct);

            var existingDto = MapToDto(existingDeal);
            await PopulateContactDetailsAsync(new List<GhlDealResponseDto> { existingDto }, new List<GhlDeal> { existingDeal }, ct);

            return Ok(ApiResponse<GhlDealResponseDto>.SuccessResult(existingDto, "Deal updated."));
        }

        var deal = new GhlDeal
        {
            CompanyId = companyId.Value,
            AssignedAgentId = agentId.Value,
            Title = dto.Title.Trim(),
            CustomerId = (dto.CustomerId.HasValue && dto.CustomerId.Value > 0) ? dto.CustomerId.Value : null,
            CustomerName = dto.CustomerName.Trim(),
            Stage = string.IsNullOrWhiteSpace(dto.Stage) ? "new" : dto.Stage.Trim(),
            Value = dto.Value,
            ExpectedCloseDate = dto.ExpectedCloseDate.Trim(),
            Notes = dto.Notes.Trim(),
            InvestorType = dto.InvestorType,
            InvestmentRange = OptionalFieldNormalizer.Normalize(dto.InvestmentRange),
            PreferredAssetClass = OptionalFieldNormalizer.Normalize(dto.PreferredAssetClass),
            Priority = string.IsNullOrWhiteSpace(dto.Priority) ? "Medium" : dto.Priority.Trim(),
            StageEnteredAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
        };

        _db.GhlDeals.Add(deal);
        await _db.SaveChangesAsync(ct);
        await _db.Entry(deal).Reference(d => d.AssignedAgent).LoadAsync(ct);

        var newDto = MapToDto(deal);
        await PopulateContactDetailsAsync(new List<GhlDealResponseDto> { newDto }, new List<GhlDeal> { deal }, ct);

        return CreatedAtAction(nameof(GetDeal), new { id = deal.Id },
            ApiResponse<GhlDealResponseDto>.SuccessResult(newDto, "Deal created."));
    }

    // ── PUT /api/ghl/deals/{id} ───────────────────────────────────────────────
    [HttpPut("{id:int}")]
    public async Task<ActionResult<ApiResponse<GhlDealResponseDto>>> UpdateDeal(
        int id, [FromBody] UpdateGhlDealDto dto, CancellationToken ct)
    {
        var deal = await _db.GhlDeals
            .Include(d => d.AssignedAgent)
            .ThenInclude(a => a.Role)
            .Include(d => d.Customer)
            .FirstOrDefaultAsync(d => d.Id == id && (!_currentUser.CompanyId.HasValue || d.CompanyId == _currentUser.CompanyId.Value), ct);

        if (deal == null)
            return NotFound(ApiResponse<GhlDealResponseDto>.FailureResult("Deal not found."));

        if (IsIrmDeal(deal) && User.IsGhlAdmin())
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<GhlDealResponseDto>.FailureResult("Access denied: GHL Admin has read-only access to IRM deal data."));
        }

        if (dto.Title != null) deal.Title = dto.Title.Trim();
        if (dto.Stage != null) deal.Stage = dto.Stage.Trim();
        if (dto.Value.HasValue) deal.Value = dto.Value.Value;
        if (dto.ExpectedCloseDate != null) deal.ExpectedCloseDate = dto.ExpectedCloseDate.Trim();
        if (dto.Notes != null) deal.Notes = dto.Notes.Trim();
        if (dto.LostReason != null) deal.LostReason = dto.LostReason.Trim();
        if (dto.InvestorType != null) deal.InvestorType = dto.InvestorType;
        if (dto.InvestmentRange != null) deal.InvestmentRange = OptionalFieldNormalizer.Normalize(dto.InvestmentRange);
        if (dto.PreferredAssetClass != null) deal.PreferredAssetClass = OptionalFieldNormalizer.Normalize(dto.PreferredAssetClass);
        if (dto.Priority != null) deal.Priority = dto.Priority.Trim();
        if (dto.StageEnteredAt.HasValue) deal.StageEnteredAt = dto.StageEnteredAt.Value;
        if (dto.InvestmentAmountConfirmed.HasValue) deal.InvestmentAmountConfirmed = dto.InvestmentAmountConfirmed.Value;
        if (dto.KycStatus != null) deal.KycStatus = dto.KycStatus.Trim();

        deal.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        var updateDto = MapToDto(deal);
        await PopulateContactDetailsAsync(new List<GhlDealResponseDto> { updateDto }, new List<GhlDeal> { deal }, ct);

        return Ok(ApiResponse<GhlDealResponseDto>.SuccessResult(updateDto, "Deal updated."));
    }

    // ── DELETE /api/ghl/deals/{id} ────────────────────────────────────────────
    [HttpDelete("{id:int}")]
    [Authorize(Roles = "company_admin,super_admin")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteDeal(int id, CancellationToken ct)
    {
        var isSuperAdmin = _currentUser.Role == "super_admin";
        var deal = await _db.GhlDeals
            .Include(d => d.AssignedAgent)
            .ThenInclude(a => a.Role)
            .FirstOrDefaultAsync(d => d.Id == id && (isSuperAdmin || !_currentUser.CompanyId.HasValue || d.CompanyId == _currentUser.CompanyId.Value), ct);

        if (deal == null)
            return NotFound(ApiResponse<bool>.FailureResult("Deal not found."));

        if (IsIrmDeal(deal) && User.IsGhlAdmin())
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<bool>.FailureResult("Access denied: GHL Admin has read-only access to IRM deal data."));
        }

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
        var companyId = _currentUser.CompanyId;
        if (!companyId.HasValue || companyId.Value <= 0)
            return Unauthorized(ApiResponse<GhlDealActivityResponseDto>.FailureResult("Unauthorized: Company ID is missing."));

        // Verify deal belongs to this company
        var deal = await _db.GhlDeals
            .Include(d => d.AssignedAgent)
            .ThenInclude(a => a.Role)
            .FirstOrDefaultAsync(d => d.Id == id && d.CompanyId == companyId.Value, ct);

        if (deal == null)
            return NotFound(ApiResponse<GhlDealActivityResponseDto>.FailureResult("Deal not found."));

        if (IsIrmDeal(deal) && User.IsGhlAdmin())
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<GhlDealActivityResponseDto>.FailureResult("Access denied: GHL Admin has read-only access to IRM deal data."));
        }

        var activity = new GhlDealActivity
        {
            DealId = id,
            CompanyId = companyId.Value,
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
        InvestmentAmountConfirmed = d.InvestmentAmountConfirmed,
        KycStatus = d.KycStatus,
        KycId = d.KycId,
        VerifiedBy = d.VerifiedBy,
        VerifiedAt = d.VerifiedAt,
        Remarks = d.Remarks,
        FlaggedSections = d.FlaggedSections,
        // Resolve contact details from the authoritative Customer record first,
        // then fall back to any denormalised contact data on the deal itself.
        Phone = (!string.IsNullOrWhiteSpace(d.Customer?.Phone) ? d.Customer.Phone : null),
        Email = (!string.IsNullOrWhiteSpace(d.Customer?.Email) ? d.Customer.Email : null),
        Location = (!string.IsNullOrWhiteSpace(d.Customer?.Location) ? d.Customer.Location : null),
    };

    private async Task PopulateContactDetailsAsync(
        List<GhlDealResponseDto> dtos,
        List<GhlDeal> deals,
        CancellationToken ct)
    {
        var unresolved = dtos
            .Zip(deals, (dto, deal) => new { Dto = dto, Deal = deal })
            .Where(x => string.IsNullOrWhiteSpace(x.Dto.Phone) || string.IsNullOrWhiteSpace(x.Dto.Email) || string.IsNullOrWhiteSpace(x.Dto.Location))
            .ToList();

        if (!unresolved.Any()) return;

        var companyId = _currentUser.CompanyId;
        var candidateIds = unresolved
            .Where(x => x.Deal.CustomerId.HasValue && x.Deal.CustomerId.Value > 0)
            .Select(x => x.Deal.CustomerId!.Value)
            .Distinct()
            .ToList();

        var candidateNames = unresolved
            .Where(x => !string.IsNullOrWhiteSpace(x.Deal.CustomerName))
            .Select(x => x.Deal.CustomerName.Trim().ToLower())
            .Distinct()
            .ToList();

        // 1. Check Leads table (for deals originating from leads)
        var leadsQuery = _db.Leads.AsNoTracking();
        if (companyId.HasValue && companyId.Value > 0)
            leadsQuery = leadsQuery.Where(l => l.CompanyId == companyId.Value);

        var matchingLeads = await leadsQuery
            .Where(l => candidateIds.Contains(l.Id) || candidateNames.Contains(l.Name.ToLower()))
            .ToListAsync(ct);

        var leadsById = matchingLeads.ToDictionary(l => l.Id);
        var leadsByName = matchingLeads
            .GroupBy(l => l.Name.Trim().ToLower())
            .ToDictionary(g => g.Key, g => g.First());

        // 2. Check Customers table by name (for deals where CustomerId wasn't set or was a lead ID)
        var customersQuery = _db.Customers.AsNoTracking();
        if (companyId.HasValue && companyId.Value > 0)
            customersQuery = customersQuery.Where(c => c.CompanyId == companyId.Value);

        var matchingCustomers = await customersQuery
            .Where(c => candidateNames.Contains(c.Name.ToLower()))
            .ToListAsync(ct);

        var customersByName = matchingCustomers
            .GroupBy(c => c.Name.Trim().ToLower())
            .ToDictionary(g => g.Key, g => g.First());

        // 3. Check Investors table (for deals linked to HNW investors)
        var investorsQuery = _db.Investors.AsNoTracking();
        if (companyId.HasValue && companyId.Value > 0)
            investorsQuery = investorsQuery.Where(i => i.CompanyId == companyId.Value);

        var matchingInvestors = await investorsQuery
            .Where(i => candidateIds.Contains(i.Id) || candidateNames.Contains(i.Name.ToLower()))
            .ToListAsync(ct);

        var investorsById = matchingInvestors.ToDictionary(i => i.Id);
        var investorsByName = matchingInvestors
            .GroupBy(i => i.Name.Trim().ToLower())
            .ToDictionary(g => g.Key, g => g.First());

        foreach (var item in unresolved)
        {
            var deal = item.Deal;
            var dto = item.Dto;
            var nameKey = deal.CustomerName.Trim().ToLower();

            // Match Lead: ID first, then Name
            Lead? matchedLead = null;
            if (deal.CustomerId.HasValue && leadsById.TryGetValue(deal.CustomerId.Value, out var lById))
                matchedLead = lById;
            else if (!string.IsNullOrWhiteSpace(nameKey) && leadsByName.TryGetValue(nameKey, out var lByName))
                matchedLead = lByName;

            // Match Customer: Name
            Customer? matchedCust = null;
            if (!string.IsNullOrWhiteSpace(nameKey) && customersByName.TryGetValue(nameKey, out var cByName))
                matchedCust = cByName;

            // Match Investor: ID first, then Name
            Investor? matchedInv = null;
            if (deal.CustomerId.HasValue && investorsById.TryGetValue(deal.CustomerId.Value, out var iById))
                matchedInv = iById;
            else if (!string.IsNullOrWhiteSpace(nameKey) && investorsByName.TryGetValue(nameKey, out var iByName))
                matchedInv = iByName;

            // Fallback order: Customer -> Lead -> Investor
            if (string.IsNullOrWhiteSpace(dto.Phone))
            {
                dto.Phone = !string.IsNullOrWhiteSpace(matchedLead?.Phone)
                    ? matchedLead.Phone
                    : (!string.IsNullOrWhiteSpace(matchedCust?.Phone)
                        ? matchedCust.Phone
                        : matchedInv?.Phone);
            }

            if (string.IsNullOrWhiteSpace(dto.Email))
            {
                dto.Email = !string.IsNullOrWhiteSpace(matchedLead?.Email)
                    ? matchedLead.Email
                    : (!string.IsNullOrWhiteSpace(matchedCust?.Email)
                        ? matchedCust.Email
                        : matchedInv?.Email);
            }

            if (string.IsNullOrWhiteSpace(dto.Location))
            {
                dto.Location = !string.IsNullOrWhiteSpace(matchedLead?.Location)
                    ? matchedLead.Location
                    : matchedCust?.Location;
            }
        }
    }
}
