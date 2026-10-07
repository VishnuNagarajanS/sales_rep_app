using backend.Authentication.Interfaces;
using backend.Helpers;
using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.GhlInvestors;
using backend.Extensions;
using backend.Models.Entities;
using backend.Models.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using backend.Services.Interfaces;
using backend.Services.Implementations;

namespace backend.Controllers.GhlAdmin;

/// <summary>
/// Converted Investors 360 API.
/// Operates directly on the primary Investors table (single source of truth).
/// Scoped to CompanyId. Sales Executives and IRM officers see only their assigned investors.
/// Company Admins and Super Admins see all investors in the company.
/// </summary>
[ApiController]
[Route("api/ghl/investors")]
[Authorize(Roles = "sales_executive,company_admin,super_admin,irm")]
public class GhlInvestorsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IIrmOtherService _otherService;

    public GhlInvestorsController(ApplicationDbContext db, ICurrentUserService currentUser, IIrmOtherService? otherService = null)
    {
        _db = db;
        _currentUser = currentUser;
        _otherService = otherService ?? new IrmOtherService(db);
    }

    private IQueryable<Investor> ScopedQuery()
    {
        var query = _db.Investors.AsNoTracking()
            .Include(i => i.AssignedIrm)
            .AsQueryable();

        var companyId = _currentUser.CompanyId;
        var role = _currentUser.Role;
        var agentId = _currentUser.UserId;

        if (companyId.HasValue)
            query = query.Where(i => i.CompanyId == companyId.Value);

        // Sales Executives and IRMs only see investors they own
        if ((role == "sales_executive" || role == "irm") && agentId.HasValue)
            query = query.Where(i => i.AssignedIrmId == agentId.Value);

        // Converted Investors 360: only include converted customers, not raw leads
        query = query.Where(i => i.Status != InvestorStatus.Lead || _db.GhlDeals.Any(d =>
            (d.CustomerId == i.Id || (!string.IsNullOrEmpty(i.Name) && d.CustomerName == i.Name)) &&
            (d.Stage == "converted" || d.Stage == "won")));

        return query;
    }

    // ── GET /api/ghl/investors ────────────────────────────────────────────────
    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResult<GhlInvestorResponseDto>>>> GetInvestors(
        [FromQuery] string? status,
        [FromQuery] string? assetClass,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 100,
        CancellationToken ct = default)
    {
        var query = ScopedQuery();

        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            var normalizedStatus = status.Replace(" ", "");
            if (Enum.TryParse<InvestorStatus>(normalizedStatus, true, out var parsedStatus))
            {
                query = query.Where(i => i.Status == parsedStatus);
            }
        }

        if (!string.IsNullOrWhiteSpace(assetClass) && !assetClass.Equals("All", StringComparison.OrdinalIgnoreCase))
            query = query.Where(i => i.PreferredAssetClass == assetClass);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(i =>
                i.Name.ToLower().Contains(s) ||
                i.Phone.Contains(s) ||
                i.Email.ToLower().Contains(s));
        }

        var companyId = _currentUser.CompanyId ?? 1;
        var otherMatcher = await _otherService.GetOtherMatcherAsync(companyId, "investor_360", ct);

        var entities = await query
            .OrderByDescending(i => i.CreatedAt)
            .ToListAsync(ct);

        if (otherMatcher.HasAnyOther)
        {
            entities = entities
                .Where(i => !otherMatcher.IsInOther(i.Phone, i.Id, null, i.Name))
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

        return Ok(ApiResponse<PagedResult<GhlInvestorResponseDto>>.SuccessResult(
            PagedResult<GhlInvestorResponseDto>.Create(items, total, page, pageSize),
            "GHL investors retrieved."));
    }

    // ── GET /api/ghl/investors/{id} ───────────────────────────────────────────
    [HttpGet("{id:int}")]
    public async Task<ActionResult<ApiResponse<GhlInvestorResponseDto>>> GetInvestor(
        int id, CancellationToken ct)
    {
        var inv = await ScopedQuery().FirstOrDefaultAsync(i => i.Id == id, ct);
        if (inv == null)
            return NotFound(ApiResponse<GhlInvestorResponseDto>.FailureResult("Investor not found."));

        return Ok(ApiResponse<GhlInvestorResponseDto>.SuccessResult(MapToDto(inv)));
    }

    // ── POST /api/ghl/investors ───────────────────────────────────────────────
    [HttpPost]
    public async Task<ActionResult<ApiResponse<GhlInvestorResponseDto>>> CreateInvestor(
        [FromBody] CreateGhlInvestorDto dto, CancellationToken ct)
    {
        if (User.IsGhlAdmin())
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<GhlInvestorResponseDto>.FailureResult("Access denied: GHL Admin has read-only access to IRM investor data."));
        }

        var agentId = _currentUser.UserId;
        if (!agentId.HasValue || agentId.Value <= 0)
            return Unauthorized(ApiResponse<GhlInvestorResponseDto>.FailureResult("Unauthorized: User ID is missing."));

        var companyId = _currentUser.CompanyId;
        if (!companyId.HasValue || companyId.Value <= 0)
            return Unauthorized(ApiResponse<GhlInvestorResponseDto>.FailureResult("Unauthorized: Company ID is missing."));

        var status = InvestorStatus.Lead;
        if (!string.IsNullOrWhiteSpace(dto.Status))
        {
            Enum.TryParse<InvestorStatus>(dto.Status.Replace(" ", ""), true, out status);
        }

        var investor = new Investor
        {
            CompanyId = companyId.Value,
            AssignedIrmId = agentId.Value,
            AssignedIrmName = User.Identity?.Name ?? string.Empty,
            Name = dto.Name.Trim(),
            Phone = dto.Phone.Trim(),
            Email = dto.Email?.Trim() ?? string.Empty,
            Status = status,
            InvestmentCapacity = OptionalFieldNormalizer.Normalize(dto.InvestmentCapacity) ?? string.Empty,
            PreferredAssetClass = OptionalFieldNormalizer.Normalize(dto.PreferredAssetClass) ?? string.Empty,
            ReferralSource = dto.ReferralSource?.Trim(),
            CommittedAum = dto.CommittedAUM?.Trim(),
            InvestmentMandate = dto.InvestmentMandate?.Trim(),
            RiskTolerance = dto.RiskTolerance?.Trim(),
            Notes = dto.Notes.Trim(),
            CreatedAt = DateTime.UtcNow,
        };

        _db.Investors.Add(investor);
        await _db.SaveChangesAsync(ct);
        await _db.Entry(investor).Reference(i => i.AssignedIrm).LoadAsync(ct);

        return CreatedAtAction(nameof(GetInvestor), new { id = investor.Id },
            ApiResponse<GhlInvestorResponseDto>.SuccessResult(MapToDto(investor), "Investor created."));
    }

    // ── PUT /api/ghl/investors/{id} ───────────────────────────────────────────
    [HttpPut("{id:int}")]
    public async Task<ActionResult<ApiResponse<GhlInvestorResponseDto>>> UpdateInvestor(
        int id, [FromBody] UpdateGhlInvestorDto dto, CancellationToken ct)
    {
        if (User.IsGhlAdmin())
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<GhlInvestorResponseDto>.FailureResult("Access denied: GHL Admin has read-only access to IRM investor data."));
        }

        var investor = await _db.Investors
            .Include(i => i.AssignedIrm)
            .FirstOrDefaultAsync(i => i.Id == id && i.CompanyId == _currentUser.CompanyId, ct);

        if (investor == null)
            return NotFound(ApiResponse<GhlInvestorResponseDto>.FailureResult("Investor not found."));

        if (dto.Name != null) investor.Name = dto.Name.Trim();
        if (dto.Phone != null) investor.Phone = dto.Phone.Trim();
        if (dto.Email != null) investor.Email = dto.Email.Trim();
        if (dto.Status != null && Enum.TryParse<InvestorStatus>(dto.Status.Replace(" ", ""), true, out var parsedStatus))
            investor.Status = parsedStatus;
        if (dto.InvestmentCapacity != null) investor.InvestmentCapacity = OptionalFieldNormalizer.Normalize(dto.InvestmentCapacity) ?? string.Empty;
        if (dto.PreferredAssetClass != null) investor.PreferredAssetClass = OptionalFieldNormalizer.Normalize(dto.PreferredAssetClass) ?? string.Empty;
        if (dto.ReferralSource != null) investor.ReferralSource = dto.ReferralSource.Trim();
        if (dto.CommittedAUM != null) investor.CommittedAum = dto.CommittedAUM.Trim();
        if (dto.InvestmentMandate != null) investor.InvestmentMandate = dto.InvestmentMandate.Trim();
        if (dto.RiskTolerance != null) investor.RiskTolerance = dto.RiskTolerance.Trim();
        if (dto.Notes != null) investor.Notes = dto.Notes.Trim();

        investor.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(ApiResponse<GhlInvestorResponseDto>.SuccessResult(MapToDto(investor), "Investor updated."));
    }

    // ── DELETE /api/ghl/investors/{id} ────────────────────────────────────────
    [HttpDelete("{id:int}")]
    [Authorize(Roles = "company_admin,super_admin,irm")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteInvestor(int id, CancellationToken ct)
    {
        if (User.IsGhlAdmin())
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<bool>.FailureResult("Access denied: GHL Admin has read-only access to IRM investor data."));
        }

        var investor = await _db.Investors
            .FirstOrDefaultAsync(i => i.Id == id && i.CompanyId == _currentUser.CompanyId, ct);

        if (investor == null)
            return NotFound(ApiResponse<bool>.FailureResult("Investor not found."));

        _db.Investors.Remove(investor);
        await _db.SaveChangesAsync(ct);

        return Ok(ApiResponse<bool>.SuccessResult(true, "Investor deleted."));
    }

    private static GhlInvestorResponseDto MapToDto(Investor i) => new()
    {
        Id = i.Id,
        CompanyId = i.CompanyId,
        AssignedAgentId = i.AssignedIrmId ?? 0,
        AssignedAgentName = i.AssignedIrm?.Name ?? i.AssignedIrmName,
        Name = i.Name,
        Phone = i.Phone,
        Email = i.Email,
        Status = i.Status == InvestorStatus.ActiveInvestor ? "Active Investor" :
                 i.Status == InvestorStatus.HnwInvestor ? "HNW Investor" :
                 i.Status.ToString(),
        InvestmentCapacity = i.InvestmentCapacity,
        PreferredAssetClass = i.PreferredAssetClass,
        ReferralSource = i.ReferralSource,
        CommittedAUM = i.CommittedAum,
        InvestmentMandate = i.InvestmentMandate,
        RiskTolerance = i.RiskTolerance,
        Notes = i.Notes,
        CreatedAt = i.CreatedAt,
        UpdatedAt = i.UpdatedAt,
    };
}

