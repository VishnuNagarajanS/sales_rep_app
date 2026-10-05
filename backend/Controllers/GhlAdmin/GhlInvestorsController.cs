using backend.Authentication.Interfaces;
using backend.Helpers;
using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.GhlInvestors;
using backend.Extensions;
using backend.Models.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers.GhlAdmin;

/// <summary>
/// GHL India Ventures — HNW Investor Profiles API.
/// Serves the Investors page and the KYC module.
/// Scoped to CompanyId 1 (GHL). Sales Executives see only their assigned investors.
/// Company Admins and IRM officers see all investors in the company.
/// </summary>
[ApiController]
[Route("api/ghl/investors")]
[Authorize(Roles = "sales_executive,company_admin,super_admin,irm")]
public class GhlInvestorsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;

    public GhlInvestorsController(ApplicationDbContext db, ICurrentUserService currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    private async Task EnsureInvestorsSyncedAsync(CancellationToken ct = default)
    {
        try
        {
            var irmInvestors = await _db.Investors.AsNoTracking().ToListAsync(ct);
            var ghlInvestors = await _db.GhlInvestors.ToListAsync(ct);

            bool anyAdded = false;
            foreach (var irmInv in irmInvestors)
            {
                var phoneDigits = new string((irmInv.Phone ?? "").Where(char.IsDigit).ToArray());
                var last10 = phoneDigits.Length >= 10 ? phoneDigits[^10..] : phoneDigits;
                var email = (irmInv.Email ?? "").Trim().ToLower();

                var exists = ghlInvestors.Any(g =>
                    (!string.IsNullOrEmpty(email) && g.Email.Trim().ToLower() == email) ||
                    (!string.IsNullOrEmpty(last10) && new string(g.Phone.Where(char.IsDigit).ToArray()).EndsWith(last10))
                );

                if (!exists)
                {
                    _db.GhlInvestors.Add(new GhlInvestor
                    {
                        CompanyId = irmInv.CompanyId,
                        AssignedAgentId = irmInv.AssignedIrmId ?? 5,
                        Name = irmInv.Name,
                        Phone = irmInv.Phone,
                        Email = irmInv.Email,
                        Status = irmInv.Status.ToString(),
                        InvestmentCapacity = irmInv.InvestmentCapacity ?? string.Empty,
                        PreferredAssetClass = irmInv.PreferredAssetClass ?? string.Empty,
                        ReferralSource = irmInv.ReferralSource,
                        CommittedAUM = irmInv.CommittedAum,
                        InvestmentMandate = irmInv.InvestmentMandate,
                        RiskTolerance = irmInv.RiskTolerance,
                        Notes = irmInv.Notes ?? string.Empty,
                        CreatedAt = irmInv.CreatedAt,
                        UpdatedAt = irmInv.UpdatedAt
                    });
                    anyAdded = true;
                }
            }
            if (anyAdded)
            {
                await _db.SaveChangesAsync(ct);
            }
        }
        catch (Exception ex)
        {
            // Logging or non-fatal fallback
            System.Diagnostics.Debug.WriteLine($"[GhlInvestorsController] Sync failed: {ex.Message}");
        }
    }

    private IQueryable<GhlInvestor> ScopedQuery()
    {
        var query = _db.GhlInvestors.AsNoTracking()
            .Include(i => i.AssignedAgent)
            .AsQueryable();

        var companyId = _currentUser.CompanyId;
        var role = _currentUser.Role;
        var agentId = _currentUser.UserId;

        if (companyId.HasValue)
            query = query.Where(i => i.CompanyId == companyId.Value);

        // Sales Executives and IRMs only see investors they own
        if ((role == "sales_executive" || role == "irm") && agentId.HasValue)
            query = query.Where(i => i.AssignedAgentId == agentId.Value);

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
        await EnsureInvestorsSyncedAsync(ct);
        var query = ScopedQuery();

        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("All", StringComparison.OrdinalIgnoreCase))
            query = query.Where(i => i.Status == status);

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

        var total = await query.CountAsync(ct);
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var entities = await query
            .OrderByDescending(i => i.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var items = entities.Select(MapToDto).ToList();

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

        var investor = new GhlInvestor
        {
            CompanyId = companyId.Value,
            AssignedAgentId = agentId.Value,
            Name = dto.Name.Trim(),
            Phone = dto.Phone.Trim(),
            Email = dto.Email?.Trim() ?? string.Empty,
            Status = string.IsNullOrWhiteSpace(dto.Status) ? "Lead" : dto.Status.Trim(),
            InvestmentCapacity = OptionalFieldNormalizer.Normalize(dto.InvestmentCapacity) ?? string.Empty,
            PreferredAssetClass = OptionalFieldNormalizer.Normalize(dto.PreferredAssetClass) ?? string.Empty,
            ReferralSource = dto.ReferralSource?.Trim(),
            CommittedAUM = dto.CommittedAUM?.Trim(),
            InvestmentMandate = dto.InvestmentMandate?.Trim(),
            RiskTolerance = dto.RiskTolerance?.Trim(),
            Notes = dto.Notes.Trim(),
            CreatedAt = DateTime.UtcNow,
        };

        _db.GhlInvestors.Add(investor);
        await _db.SaveChangesAsync(ct);
        await _db.Entry(investor).Reference(i => i.AssignedAgent).LoadAsync(ct);

        try
        {
            var phoneDigits = new string(investor.Phone.Where(char.IsDigit).ToArray());
            var last10 = phoneDigits.Length >= 10 ? phoneDigits[^10..] : phoneDigits;
            var email = investor.Email.Trim().ToLower();

            var irmInv = await _db.Investors.FirstOrDefaultAsync(i =>
                (!string.IsNullOrEmpty(email) && i.Email.Trim().ToLower() == email) ||
                (!string.IsNullOrEmpty(last10) && i.Phone.Replace("-", "").Replace(" ", "").EndsWith(last10)), ct);

            if (irmInv == null)
            {
                _db.Investors.Add(new Investor
                {
                    CompanyId = companyId.Value,
                    AssignedIrmId = agentId.Value,
                    AssignedIrmName = investor.AssignedAgent?.Name ?? User.Identity?.Name ?? string.Empty,
                    Name = investor.Name,
                    Phone = investor.Phone,
                    Email = investor.Email,
                    Status = Enum.TryParse<backend.Models.Enums.InvestorStatus>(investor.Status, true, out var s) ? s : backend.Models.Enums.InvestorStatus.Lead,
                    InvestmentCapacity = investor.InvestmentCapacity,
                    PreferredAssetClass = investor.PreferredAssetClass,
                    ReferralSource = investor.ReferralSource,
                    CommittedAum = investor.CommittedAUM,
                    InvestmentMandate = investor.InvestmentMandate,
                    RiskTolerance = investor.RiskTolerance,
                    Notes = investor.Notes,
                    CreatedAt = investor.CreatedAt
                });
                await _db.SaveChangesAsync(ct);
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[GhlInvestorsController] Mirror to Investors failed: {ex.Message}");
        }

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

        var investor = await _db.GhlInvestors
            .Include(i => i.AssignedAgent)
            .FirstOrDefaultAsync(i => i.Id == id && i.CompanyId == _currentUser.CompanyId, ct);

        if (investor == null)
            return NotFound(ApiResponse<GhlInvestorResponseDto>.FailureResult("Investor not found."));

        if (dto.Name != null) investor.Name = dto.Name.Trim();
        if (dto.Phone != null) investor.Phone = dto.Phone.Trim();
        if (dto.Email != null) investor.Email = dto.Email.Trim();
        if (dto.Status != null) investor.Status = dto.Status.Trim();
        if (dto.InvestmentCapacity != null) investor.InvestmentCapacity = OptionalFieldNormalizer.Normalize(dto.InvestmentCapacity) ?? string.Empty;
        if (dto.PreferredAssetClass != null) investor.PreferredAssetClass = OptionalFieldNormalizer.Normalize(dto.PreferredAssetClass) ?? string.Empty;
        if (dto.ReferralSource != null) investor.ReferralSource = dto.ReferralSource.Trim();
        if (dto.CommittedAUM != null) investor.CommittedAUM = dto.CommittedAUM.Trim();
        if (dto.InvestmentMandate != null) investor.InvestmentMandate = dto.InvestmentMandate.Trim();
        if (dto.RiskTolerance != null) investor.RiskTolerance = dto.RiskTolerance.Trim();
        if (dto.Notes != null) investor.Notes = dto.Notes.Trim();

        investor.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        try
        {
            var phoneDigits = new string(investor.Phone.Where(char.IsDigit).ToArray());
            var last10 = phoneDigits.Length >= 10 ? phoneDigits[^10..] : phoneDigits;
            var email = investor.Email.Trim().ToLower();

            var irmInv = await _db.Investors.FirstOrDefaultAsync(i =>
                (!string.IsNullOrEmpty(email) && i.Email.Trim().ToLower() == email) ||
                (!string.IsNullOrEmpty(last10) && i.Phone.Replace("-", "").Replace(" ", "").EndsWith(last10)), ct);

            if (irmInv != null)
            {
                if (dto.Name != null) irmInv.Name = investor.Name;
                if (dto.Phone != null) irmInv.Phone = investor.Phone;
                if (dto.Email != null) irmInv.Email = investor.Email;
                if (dto.Status != null && Enum.TryParse<backend.Models.Enums.InvestorStatus>(dto.Status, true, out var s)) irmInv.Status = s;
                if (dto.InvestmentCapacity != null) irmInv.InvestmentCapacity = investor.InvestmentCapacity;
                if (dto.PreferredAssetClass != null) irmInv.PreferredAssetClass = investor.PreferredAssetClass;
                if (dto.ReferralSource != null) irmInv.ReferralSource = investor.ReferralSource;
                if (dto.CommittedAUM != null) irmInv.CommittedAum = investor.CommittedAUM;
                if (dto.InvestmentMandate != null) irmInv.InvestmentMandate = investor.InvestmentMandate;
                if (dto.RiskTolerance != null) irmInv.RiskTolerance = investor.RiskTolerance;
                if (dto.Notes != null) irmInv.Notes = investor.Notes;
                irmInv.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync(ct);
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[GhlInvestorsController] Mirror update to Investors failed: {ex.Message}");
        }

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

        var investor = await _db.GhlInvestors
            .FirstOrDefaultAsync(i => i.Id == id && i.CompanyId == _currentUser.CompanyId, ct);

        if (investor == null)
            return NotFound(ApiResponse<bool>.FailureResult("Investor not found."));

        _db.GhlInvestors.Remove(investor);
        await _db.SaveChangesAsync(ct);

        return Ok(ApiResponse<bool>.SuccessResult(true, "Investor deleted."));
    }

    private static GhlInvestorResponseDto MapToDto(GhlInvestor i) => new()
    {
        Id = i.Id,
        CompanyId = i.CompanyId,
        AssignedAgentId = i.AssignedAgentId,
        AssignedAgentName = i.AssignedAgent?.Name,
        Name = i.Name,
        Phone = i.Phone,
        Email = i.Email,
        Status = i.Status,
        InvestmentCapacity = i.InvestmentCapacity,
        PreferredAssetClass = i.PreferredAssetClass,
        ReferralSource = i.ReferralSource,
        CommittedAUM = i.CommittedAUM,
        InvestmentMandate = i.InvestmentMandate,
        RiskTolerance = i.RiskTolerance,
        Notes = i.Notes,
        CreatedAt = i.CreatedAt,
        UpdatedAt = i.UpdatedAt,
    };
}
