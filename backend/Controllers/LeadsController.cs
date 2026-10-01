using backend.Data;
using backend.DTOs.Common;
using backend.Models.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LeadsController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public LeadsController(ApplicationDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetLeads([FromQuery] int? tenantId, CancellationToken ct)
    {
        var query = _db.Leads.AsNoTracking().Include(l => l.SiteVisits).AsQueryable();

        if (tenantId.HasValue)
        {
            query = query.Where(l => l.CompanyId == tenantId.Value);
        }

        var leads = await query.OrderByDescending(l => l.CreatedAt).ToListAsync(ct);
        return Ok(ApiResponse<List<Lead>>.SuccessResult(leads));
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetLeadById(int id, CancellationToken ct)
    {
        var lead = await _db.Leads.Include(l => l.SiteVisits).FirstOrDefaultAsync(l => l.Id == id, ct);
        if (lead == null)
            return NotFound(ApiResponse<Lead>.FailureResult("Lead not found"));

        return Ok(ApiResponse<Lead>.SuccessResult(lead));
    }

    [HttpPost]
    public async Task<IActionResult> CreateLead([FromBody] Lead lead, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(lead.Name) || string.IsNullOrWhiteSpace(lead.Phone))
            return BadRequest(ApiResponse<Lead>.FailureResult("Name and Phone are required"));

        lead.CreatedAt = DateTime.UtcNow;
        _db.Leads.Add(lead);
        await _db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetLeadById), new { id = lead.Id }, ApiResponse<Lead>.SuccessResult(lead, "Lead created"));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateLead(int id, [FromBody] Lead updated, CancellationToken ct)
    {
        var existing = await _db.Leads.FirstOrDefaultAsync(l => l.Id == id, ct);
        if (existing == null)
            return NotFound(ApiResponse<Lead>.FailureResult("Lead not found"));

        existing.Name = updated.Name;
        existing.Phone = updated.Phone;
        existing.Email = updated.Email;
        existing.Location = updated.Location;
        existing.Source = updated.Source;
        existing.Status = updated.Status;
        existing.Priority = updated.Priority;
        existing.AssignedAgentId = updated.AssignedAgentId;
        existing.AssignedAgentName = updated.AssignedAgentName;
        existing.TargetDevelopment = updated.TargetDevelopment;
        existing.PreferredVisitDate = updated.PreferredVisitDate;
        existing.PreferredTimeSlot = updated.PreferredTimeSlot;
        existing.AnythingWeShouldKnow = updated.AnythingWeShouldKnow;
        existing.WhatAreYouLookingFor = updated.WhatAreYouLookingFor;
        existing.BudgetRange = updated.BudgetRange;
        existing.InvestmentCapacity = updated.InvestmentCapacity;
        existing.AssetClass = updated.AssetClass;
        existing.Horizon = updated.Horizon;
        existing.InvestorType = updated.InvestorType;
        existing.Notes = updated.Notes;
        existing.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return Ok(ApiResponse<Lead>.SuccessResult(existing, "Lead updated"));
    }

    public class WebsiteIntakeDto
    {
        public int TenantId { get; set; } = 2; // Default: Jamin Bazaar
        public string FormType { get; set; } = "site_visit"; // "site_visit" or "callback"
        public string Name { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public string? Email { get; set; }
        public string? TargetDevelopment { get; set; }
        public string? PreferredVisitDate { get; set; }
        public string? PreferredTimeSlot { get; set; }
        public string? AnythingWeShouldKnow { get; set; }
        public string? WhatAreYouLookingFor { get; set; }
    }

    [HttpPost("website-intake")]
    public async Task<IActionResult> WebsiteIntake([FromBody] WebsiteIntakeDto dto, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(dto.Name) || string.IsNullOrWhiteSpace(dto.Phone))
            return BadRequest(ApiResponse<object>.FailureResult("Name and Phone are required"));

        var isSiteVisit = dto.FormType.ToLower().Contains("visit");

        var lead = new Lead
        {
            CompanyId = dto.TenantId,
            Name = dto.Name.Trim(),
            Phone = dto.Phone.Trim(),
            Email = string.IsNullOrWhiteSpace(dto.Email) ? null : dto.Email.Trim(),
            Source = isSiteVisit ? "Website - Site Visit" : "Website - Callback",
            Status = "New",
            Priority = "Medium",
            TargetDevelopment = isSiteVisit ? dto.TargetDevelopment : null,
            PreferredVisitDate = isSiteVisit ? dto.PreferredVisitDate : null,
            PreferredTimeSlot = isSiteVisit ? dto.PreferredTimeSlot : null,
            AnythingWeShouldKnow = isSiteVisit ? dto.AnythingWeShouldKnow : null,
            WhatAreYouLookingFor = isSiteVisit ? null : dto.WhatAreYouLookingFor,
            CreatedAt = DateTime.UtcNow
        };

        _db.Leads.Add(lead);
        await _db.SaveChangesAsync(ct);

        SiteVisit? siteVisit = null;
        if (isSiteVisit)
        {
            siteVisit = new SiteVisit
            {
                TenantId = dto.TenantId,
                LeadId = lead.Id,
                CustomerName = lead.Name,
                CustomerPhone = lead.Phone,
                ContactType = "lead",
                ProjectName = dto.TargetDevelopment ?? "Jamin Garden",
                PlotNumber = null,
                ScheduledAt = $"{dto.PreferredVisitDate ?? "Upcoming"} • {dto.PreferredTimeSlot ?? "Morning · 9–11 am"}",
                Status = "Pending", // Desk confirmation required
                VisitorNote = dto.AnythingWeShouldKnow,
                CreatedAt = DateTime.UtcNow
            };
            _db.SiteVisits.Add(siteVisit);
            await _db.SaveChangesAsync(ct);
        }

        return Ok(ApiResponse<object>.SuccessResult(new
        {
            lead,
            siteVisit
        }, "Intake processed successfully"));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteLead(int id, CancellationToken ct)
    {
        var lead = await _db.Leads.FirstOrDefaultAsync(l => l.Id == id, ct);
        if (lead == null)
            return NotFound(ApiResponse<bool>.FailureResult("Lead not found"));

        _db.Leads.Remove(lead);
        await _db.SaveChangesAsync(ct);
        return Ok(ApiResponse<bool>.SuccessResult(true, "Lead deleted successfully"));
    }
}

