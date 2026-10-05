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
        var query = _db.Leads.AsNoTracking().Include(l => l.AssignedAgent).Include(l => l.SiteVisits).AsQueryable();

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
        var lead = await _db.Leads.Include(l => l.AssignedAgent).Include(l => l.SiteVisits).FirstOrDefaultAsync(l => l.Id == id, ct);
        if (lead == null)
            return NotFound(ApiResponse<Lead>.FailureResult("Lead not found"));

        return Ok(ApiResponse<Lead>.SuccessResult(lead));
    }

    [HttpPost]
    public async Task<IActionResult> CreateLead([FromBody] Lead lead, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(lead.Name) || string.IsNullOrWhiteSpace(lead.Phone))
            return BadRequest(ApiResponse<Lead>.FailureResult("Name and Phone are required"));

        if (lead.AssignedAgentId.HasValue && lead.AssignedAgentId.Value > 0 && string.IsNullOrWhiteSpace(lead.AssignedAgentName))
        {
            var agent = await _db.Users.FirstOrDefaultAsync(u => u.Id == lead.AssignedAgentId.Value, ct);
            if (agent != null)
            {
                lead.AssignedAgentName = agent.Name;
            }
        }

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

        if (updated.AssignedAgentId.HasValue && updated.AssignedAgentId.Value > 0 && string.IsNullOrWhiteSpace(updated.AssignedAgentName))
        {
            var agent = await _db.Users.FirstOrDefaultAsync(u => u.Id == updated.AssignedAgentId.Value, ct);
            if (agent != null)
            {
                existing.AssignedAgentName = agent.Name;
            }
        }

        existing.TargetDevelopment = updated.TargetDevelopment;
        existing.PreferredVisitDate = updated.PreferredVisitDate;
        existing.PreferredTimeSlot = updated.PreferredTimeSlot;
        existing.AnythingWeShouldKnow = updated.AnythingWeShouldKnow;
        existing.WhatAreYouLookingFor = updated.WhatAreYouLookingFor;
        existing.BudgetRange = updated.BudgetRange;
        existing.ReadyToRegister = updated.ReadyToRegister;
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
            Email = string.IsNullOrWhiteSpace(dto.Email) ? string.Empty : dto.Email.Trim(),
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

    public class ConvertLeadRequest
    {
        public string? DealTitle { get; set; }
        public decimal? DealValue { get; set; }
        public string? Notes { get; set; }
    }

    [HttpPost("{id:int}/convert")]
    public async Task<IActionResult> ConvertLead(int id, [FromBody] ConvertLeadRequest? dto, CancellationToken ct)
    {
        var lead = await _db.Leads.FirstOrDefaultAsync(l => l.Id == id, ct);
        if (lead == null)
            return NotFound(ApiResponse<object>.FailureResult("Lead not found"));

        var customer = await _db.Customers.FirstOrDefaultAsync(c => c.Phone == lead.Phone && c.CompanyId == lead.CompanyId, ct);
        if (customer == null)
        {
            customer = new Customer
            {
                CompanyId = lead.CompanyId,
                AssignedAgentId = lead.AssignedAgentId,
                Name = lead.Name,
                Phone = lead.Phone,
                Email = lead.Email ?? string.Empty,
                Location = lead.Location ?? string.Empty,
                Status = "Active",
                TotalValue = dto?.DealValue ?? 0,
                Notes = dto?.Notes ?? lead.Notes,
                CustomFieldsJson = lead.CustomFieldsJson,
                LastContactedAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow
            };
            _db.Customers.Add(customer);
            await _db.SaveChangesAsync(ct);
        }
        else
        {
            customer.LastContactedAt = DateTime.UtcNow;
            if (dto?.DealValue.HasValue == true)
            {
                customer.TotalValue += dto.DealValue.Value;
            }
        }

        lead.Status = "Converted";
        lead.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(ApiResponse<object>.SuccessResult(new
        {
            customerId = customer.Id,
            leadId = lead.Id,
            status = "Converted"
        }, "Lead converted to Customer 360 successfully"));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteLead(int id, CancellationToken ct)
    {
        var lead = await _db.Leads.FirstOrDefaultAsync(l => l.Id == id, ct);
        if (lead == null)
            return NotFound(ApiResponse<bool>.FailureResult("Lead not found"));

        var siteVisits = await _db.SiteVisits.Where(s => s.LeadId == id).ToListAsync(ct);
        if (siteVisits.Count > 0)
        {
            _db.SiteVisits.RemoveRange(siteVisits);
        }

        var callRecords = await _db.CallRecords.Where(c => c.LeadId == id).ToListAsync(ct);
        foreach (var c in callRecords)
        {
            c.LeadId = null;
        }

        _db.Leads.Remove(lead);
        await _db.SaveChangesAsync(ct);
        return Ok(ApiResponse<bool>.SuccessResult(true, "Lead deleted successfully"));
    }
}

