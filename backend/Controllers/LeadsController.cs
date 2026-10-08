using backend.Data;
using backend.Authentication.Interfaces;
using backend.DTOs.Common;
using backend.Models.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "sales_executive,company_admin,sales_manager,super_admin")]
public class LeadsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;

    public LeadsController(ApplicationDbContext db, ICurrentUserService currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    private IQueryable<Lead> GetScopedLeads()
    {
        var query = _db.Leads.AsQueryable();
        if (string.Equals(_currentUser.Role, "super_admin", StringComparison.OrdinalIgnoreCase))
            return query;

        if (!_currentUser.CompanyId.HasValue)
            return query.Where(_ => false);

        query = query.Where(l => l.CompanyId == _currentUser.CompanyId.Value);
        if (string.Equals(_currentUser.Role, "sales_executive", StringComparison.OrdinalIgnoreCase))
            query = _currentUser.UserId.HasValue
                ? query.Where(l => l.AssignedAgentId == _currentUser.UserId.Value)
                : query.Where(_ => false);

        return query;
    }

    [HttpGet]
    public async Task<IActionResult> GetLeads([FromQuery] int? tenantId, [FromQuery] string? status, CancellationToken ct)
    {
        IQueryable<Lead> query = GetScopedLeads().AsNoTracking().Include(l => l.AssignedAgent);

        if (_currentUser.Role == "super_admin" && tenantId.HasValue)
        {
            query = query.Where(l => l.CompanyId == tenantId.Value);
        }

        // Converted contacts are Customers, NEVER active Leads!
        if (string.Equals(status, "Converted", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(l => l.Status == "Converted");
        }
        else if (!string.Equals(status, "all", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(l => l.Status != "Converted");
            if (!string.IsNullOrWhiteSpace(status))
            {
                query = query.Where(l => l.Status == status);
            }
        }

        var leads = await query.OrderByDescending(l => l.CreatedAt).ToListAsync(ct);
        return Ok(ApiResponse<List<Lead>>.SuccessResult(leads));
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetLeadById(int id, CancellationToken ct)
    {
        var lead = await GetScopedLeads().AsNoTracking()
            .Include(l => l.AssignedAgent)
            .Include(l => l.SiteVisits)
            .Include(l => l.Followups)
            .Include(l => l.Bookings)
            .Include(l => l.CallRecords)
            .FirstOrDefaultAsync(l => l.Id == id, ct);
        if (lead == null)
            return NotFound(ApiResponse<Lead>.FailureResult("Lead not found"));

        return Ok(ApiResponse<Lead>.SuccessResult(lead));
    }

    [HttpPost]
    public async Task<IActionResult> CreateLead([FromBody] Lead lead, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(lead.Name) || string.IsNullOrWhiteSpace(lead.Phone))
            return BadRequest(ApiResponse<Lead>.FailureResult("Name and Phone are required"));

        var isSuperAdmin = string.Equals(_currentUser.Role, "super_admin", StringComparison.OrdinalIgnoreCase);
        if (!_currentUser.CompanyId.HasValue && !isSuperAdmin)
            return Forbid();
        if (isSuperAdmin && lead.CompanyId <= 0)
            return BadRequest(ApiResponse<Lead>.FailureResult("A valid company is required."));
        if (!isSuperAdmin)
            lead.CompanyId = _currentUser.CompanyId!.Value;
        if (string.Equals(_currentUser.Role, "sales_executive", StringComparison.OrdinalIgnoreCase))
        {
            if (!_currentUser.UserId.HasValue)
                return Forbid();
            lead.AssignedAgentId = _currentUser.UserId;
        }
        if (lead.AssignedAgentId.HasValue && !await _db.Users.AnyAsync(
                u => u.Id == lead.AssignedAgentId.Value && u.CompanyId == lead.CompanyId, ct))
            return BadRequest(ApiResponse<Lead>.FailureResult("The selected agent does not belong to this company."));

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
        var existing = await GetScopedLeads().FirstOrDefaultAsync(l => l.Id == id, ct);
        if (existing == null)
            return NotFound(ApiResponse<Lead>.FailureResult("Lead not found"));

        existing.Name = updated.Name;
        existing.Phone = updated.Phone;
        existing.Email = updated.Email;
        existing.Location = updated.Location;
        existing.Source = updated.Source;
        existing.Status = updated.Status;
        existing.Priority = updated.Priority;
        if (!string.Equals(_currentUser.Role, "sales_executive", StringComparison.OrdinalIgnoreCase))
        {
            if (updated.AssignedAgentId.HasValue && !await _db.Users.AnyAsync(
                    u => u.Id == updated.AssignedAgentId.Value && u.CompanyId == existing.CompanyId, ct))
                return BadRequest(ApiResponse<Lead>.FailureResult("The selected agent does not belong to this company."));
            existing.AssignedAgentId = updated.AssignedAgentId;
            existing.AssignedAgentName = updated.AssignedAgentName;
        }

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
    [AllowAnonymous]
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
        var lead = await GetScopedLeads().FirstOrDefaultAsync(l => l.Id == id, ct);
        if (lead == null)
            return NotFound(ApiResponse<object>.FailureResult("Lead not found"));

        Customer? customer = null;
        var strategy = _db.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await _db.Database.BeginTransactionAsync(ct);
            customer = await _db.Customers.FirstOrDefaultAsync(c => c.Phone == lead.Phone && c.CompanyId == lead.CompanyId, ct);
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
                if (string.IsNullOrWhiteSpace(customer.Name)) customer.Name = lead.Name;
                if (string.IsNullOrWhiteSpace(customer.Email)) customer.Email = lead.Email ?? string.Empty;
                if (string.IsNullOrWhiteSpace(customer.Location)) customer.Location = lead.Location ?? string.Empty;
                if (string.IsNullOrWhiteSpace(customer.Notes)) customer.Notes = dto?.Notes ?? lead.Notes ?? string.Empty;
                if (customer.AssignedAgentId == null) customer.AssignedAgentId = lead.AssignedAgentId;
                customer.LastContactedAt = DateTime.UtcNow;
                if (dto?.DealValue.HasValue == true)
                {
                    customer.TotalValue += dto.DealValue.Value;
                }
            }

            lead.Status = "Converted";
            lead.UpdatedAt = DateTime.UtcNow;

            var leadCalls = await _db.CallRecords
                .Where(c => c.LeadId == lead.Id && c.CompanyId == lead.CompanyId)
                .ToListAsync(ct);
            foreach (var call in leadCalls)
                call.CustomerId = customer.Id;

            var leadFollowups = await _db.Followups
                .Where(f => f.CompanyId == lead.CompanyId &&
                    (f.LeadId == lead.Id || (f.ContactType == "lead" && f.ContactId == lead.Id.ToString())))
                .ToListAsync(ct);
            foreach (var followup in leadFollowups)
            {
                followup.CustomerId = customer.Id;
                followup.ContactType = "customer";
                followup.ContactId = customer.Id.ToString();
            }

            var leadSiteVisits = await _db.SiteVisits
                .Where(s => s.LeadId == lead.Id && s.TenantId == lead.CompanyId)
                .ToListAsync(ct);
            foreach (var visit in leadSiteVisits)
            {
                visit.CustomerId = customer.Id;
                visit.ContactType = "customer";
            }

            var leadBookings = await _db.JaminBookings
                .Where(b => b.LeadId == lead.Id && b.CompanyId == lead.CompanyId)
                .ToListAsync(ct);
            foreach (var booking in leadBookings)
                booking.CustomerId = customer.Id;

            var leadNotifications = await _db.Notifications
                .Where(n => n.LeadId == lead.Id && n.CompanyId == lead.CompanyId)
                .ToListAsync(ct);
            foreach (var notification in leadNotifications)
                notification.CustomerId = customer.Id;

            var leadAuditLogs = await _db.AuditLogs
                .Where(a => a.LeadId == lead.Id && a.CompanyId == lead.CompanyId)
                .ToListAsync(ct);
            foreach (var auditLog in leadAuditLogs)
                auditLog.CustomerId = customer.Id;

            await _db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
        });

        return Ok(ApiResponse<object>.SuccessResult(new
        {
            customerId = customer?.Id ?? 0,
            leadId = lead.Id,
            status = "Converted"
        }, "Lead converted to Customer 360 successfully"));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteLead(int id, CancellationToken ct)
    {
        var lead = await GetScopedLeads().FirstOrDefaultAsync(l => l.Id == id, ct);
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

