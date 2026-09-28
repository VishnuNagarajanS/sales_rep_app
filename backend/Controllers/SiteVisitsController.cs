using backend.Data;
using backend.DTOs.Common;
using backend.Models.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SiteVisitsController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public SiteVisitsController(ApplicationDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetSiteVisits([FromQuery] int? tenantId, CancellationToken ct)
    {
        var query = _db.SiteVisits.AsNoTracking().AsQueryable();

        if (tenantId.HasValue)
        {
            query = query.Where(sv => sv.TenantId == tenantId.Value);
        }

        var visits = await query.OrderByDescending(sv => sv.CreatedAt).ToListAsync(ct);
        return Ok(ApiResponse<List<SiteVisit>>.SuccessResult(visits));
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var visit = await _db.SiteVisits.FirstOrDefaultAsync(sv => sv.Id == id, ct);
        if (visit == null)
            return NotFound(ApiResponse<SiteVisit>.FailureResult("Site visit not found"));

        return Ok(ApiResponse<SiteVisit>.SuccessResult(visit));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] SiteVisit visit, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(visit.CustomerName) || string.IsNullOrWhiteSpace(visit.CustomerPhone))
            return BadRequest(ApiResponse<SiteVisit>.FailureResult("Customer Name and Phone are required"));

        visit.CreatedAt = DateTime.UtcNow;
        _db.SiteVisits.Add(visit);
        await _db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetById), new { id = visit.Id }, ApiResponse<SiteVisit>.SuccessResult(visit, "Site visit created"));
    }

    public class UpdateStatusDto
    {
        public string Status { get; set; } = "Scheduled";
    }

    [HttpPatch("{id:int}/status")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateStatusDto dto, CancellationToken ct)
    {
        var visit = await _db.SiteVisits.FirstOrDefaultAsync(sv => sv.Id == id, ct);
        if (visit == null)
            return NotFound(ApiResponse<SiteVisit>.FailureResult("Site visit not found"));

        visit.Status = dto.Status;
        visit.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return Ok(ApiResponse<SiteVisit>.SuccessResult(visit, $"Status updated to {dto.Status}"));
    }
}
