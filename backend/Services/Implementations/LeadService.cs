using System.Text.Json;
using backend.Authentication.Interfaces;
using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.Leads;
using backend.Models.Entities;
using backend.Models.Enums;
using backend.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Implementations;

public class LeadService : ILeadService
{
    private readonly ApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public LeadService(ApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    private static readonly string[] ExcludedStatuses = { "Not Interested", "Junk", "Converted" };

    private IQueryable<Lead> GetScopedLeadsQuery(LeadFilterDto? filter = null)
    {
        var role = _currentUser.Role;
        var agentId = _currentUser.UserId;
        var companyId = _currentUser.CompanyId;

        int? requestedCompanyId = null;
        if (filter != null && filter.CompanyId.HasValue)
        {
            requestedCompanyId = filter.CompanyId.Value;
        }
        else if (!string.IsNullOrWhiteSpace(filter?.CompanySlug))
        {
            var slug = filter.CompanySlug.Trim().ToLowerInvariant();
            if (slug == "ghl" || slug == "1" || slug == "t-ghl-01") requestedCompanyId = 1;
            else if (slug == "jamin" || slug == "2" || slug == "t-jamin-02") requestedCompanyId = 2;
        }

        var query = _context.Leads.AsNoTracking().Include(l => l.AssignedAgent).AsQueryable();

        var isSuperAdmin = string.Equals(role, "super_admin", StringComparison.OrdinalIgnoreCase);
        var isSalesExecutive = string.Equals(role, "sales_executive", StringComparison.OrdinalIgnoreCase);

        if (isSuperAdmin)
        {
            var targetCompanyId = requestedCompanyId ?? companyId;
            if (targetCompanyId.HasValue)
                query = query.Where(l => l.CompanyId == targetCompanyId.Value);
            return query;
        }

        // Never let a query parameter supply tenant scope for an authenticated user.
        if (!companyId.HasValue)
            return query.Where(_ => false);

        query = query.Where(l => l.CompanyId == companyId.Value);

        if (isSalesExecutive)
            query = agentId.HasValue ? query.Where(l => l.AssignedAgentId == agentId.Value) : query.Where(_ => false);

        return query;
    }

    private async Task<Lead?> FindScopedLeadAsync(int id, CancellationToken ct)
    {
        var role = _currentUser.Role;
        var agentId = _currentUser.UserId;
        var companyId = _currentUser.CompanyId;

        var query = _context.Leads.Include(l => l.AssignedAgent).Where(l => l.Id == id);

        if (string.Equals(role, "super_admin", StringComparison.OrdinalIgnoreCase))
        {
            return await query.FirstOrDefaultAsync(ct);
        }

        if (!companyId.HasValue)
            return null;

        query = query.Where(l => l.CompanyId == companyId.Value);

        if (string.Equals(role, "sales_executive", StringComparison.OrdinalIgnoreCase))
        {
            if (!agentId.HasValue) return null;
            query = query.Where(l => l.AssignedAgentId == agentId.Value);
        }

        return await query.FirstOrDefaultAsync(ct);
    }

    public async Task<ApiResponse<PagedResult<LeadResponseDto>>> GetActiveLeadsAsync(LeadFilterDto filter, CancellationToken ct = default)
    {
        var query = GetScopedLeadsQuery(filter);

        if (string.Equals(filter.Status, "all", StringComparison.OrdinalIgnoreCase))
        {
            // All leads
        }
        else if (!string.IsNullOrWhiteSpace(filter.Status))
        {
            query = query.Where(l => l.Status == filter.Status);
        }
        else
        {
            query = query.Where(l => l.Status != "Not Interested" && l.Status != "Junk");
        }

        // Search
        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var search = filter.Search.Trim().ToLower();
            query = query.Where(l =>
                l.Name.ToLower().Contains(search) ||
                l.Phone.Contains(search) ||
                l.Email.ToLower().Contains(search) ||
                l.Location.ToLower().Contains(search));
        }

        // Priority filter
        if (!string.IsNullOrWhiteSpace(filter.Priority) && !filter.Priority.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(l => l.Priority == filter.Priority);
        }

        var totalCount = await query.CountAsync(ct);

        // Sorting
        var isAsc = string.Equals(filter.SortOrder, "asc", StringComparison.OrdinalIgnoreCase);
        query = (filter.SortBy?.ToLower()) switch
        {
            "name" => isAsc ? query.OrderBy(l => l.Name) : query.OrderByDescending(l => l.Name),
            "status" => isAsc ? query.OrderBy(l => l.Status) : query.OrderByDescending(l => l.Status),
            "priority" => isAsc ? query.OrderBy(l => l.Priority) : query.OrderByDescending(l => l.Priority),
            _ => isAsc ? query.OrderBy(l => l.CreatedAt) : query.OrderByDescending(l => l.CreatedAt),
        };

        var page = Math.Max(1, filter.Page);
        var pageSize = Math.Clamp(filter.PageSize, 1, 100);

        var entities = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var items = entities.Select(MapToDto).ToList();

        return ApiResponse<PagedResult<LeadResponseDto>>.SuccessResult(
            PagedResult<LeadResponseDto>.Create(items, totalCount, page, pageSize),
            "Active leads retrieved successfully.");
    }

    public async Task<ApiResponse<LeadResponseDto>> GetLeadByIdAsync(int id, CancellationToken ct = default)
    {
        var lead = await FindScopedLeadAsync(id, ct);
        if (lead == null)
            return ApiResponse<LeadResponseDto>.FailureResult("Lead not found or access denied.");

        var dto = MapToDto(lead);
        var cleanPhone = new string(lead.Phone.Where(char.IsDigit).ToArray());
        var last10 = cleanPhone.Length >= 10 ? cleanPhone[^10..] : cleanPhone;

        dto.Calls = await _context.CallRecords.AsNoTracking()
            .Include(c => c.Agent)
            .Where(c => c.LeadId == lead.Id ||
                        (!string.IsNullOrEmpty(last10) && c.ContactPhone.Contains(last10)) ||
                        c.ContactPhone == lead.Phone)
            .OrderByDescending(c => c.Timestamp)
            .Take(50)
            .Select(c => new backend.DTOs.Calls.CallRecordResponseDto
            {
                Id = c.Id,
                CompanyId = c.CompanyId,
                AgentId = c.AgentId,
                AgentName = c.Agent != null ? c.Agent.Name : null,
                ContactName = c.ContactName,
                ContactPhone = c.ContactPhone,
                Direction = c.Direction,
                Duration = c.Duration,
                Disposition = c.Disposition,
                Notes = c.Notes,
                LeadId = c.LeadId,
                CustomerId = c.CustomerId,
                Timestamp = c.Timestamp,
                CreatedAt = c.CreatedAt
            })
            .ToListAsync(ct);

        return ApiResponse<LeadResponseDto>.SuccessResult(dto);
    }

    public async Task<ApiResponse<LeadResponseDto>> CreateLeadAsync(CreateLeadDto dto, CancellationToken ct = default)
    {
        // Unassigned leads should stay null and never default to admin
        var isSuperAdmin = string.Equals(_currentUser.Role, "super_admin", StringComparison.OrdinalIgnoreCase);
        var isSalesExecutive = string.Equals(_currentUser.Role, "sales_executive", StringComparison.OrdinalIgnoreCase);
        var companyId = isSuperAdmin
            ? dto.CompanyId ?? _currentUser.CompanyId
            : _currentUser.CompanyId;
        if (!companyId.HasValue)
            return ApiResponse<LeadResponseDto>.FailureResult("The authenticated user is not assigned to a company.");

        var agentId = isSalesExecutive ? _currentUser.UserId : dto.AssignedAgentId;
        if (isSalesExecutive && !agentId.HasValue)
            return ApiResponse<LeadResponseDto>.FailureResult("The authenticated sales agent could not be identified.");

        if (agentId.HasValue && !await _context.Users.AnyAsync(
                u => u.Id == agentId.Value && u.CompanyId == companyId.Value, ct))
            return ApiResponse<LeadResponseDto>.FailureResult("The selected agent or manager does not belong to this company.");

        // Build Custom Fields Dictionary for GHL
        var customFields = dto.AdditionalCustomFields ?? new Dictionary<string, string>();
        if (!string.IsNullOrWhiteSpace(dto.InvestmentCapacity)) customFields["investmentCapacity"] = dto.InvestmentCapacity;
        if (!string.IsNullOrWhiteSpace(dto.AssetClass)) customFields["assetClass"] = dto.AssetClass;
        if (!string.IsNullOrWhiteSpace(dto.PreferredAssetClass)) customFields["preferredAssetClass"] = dto.PreferredAssetClass;
        if (!string.IsNullOrWhiteSpace(dto.Horizon)) customFields["horizon"] = dto.Horizon;

        var lead = new Lead
        {
            CompanyId = companyId.Value,
            AssignedAgentId = agentId,
            Name = dto.Name.Trim(),
            Phone = dto.Phone.Trim(),
            Email = dto.Email?.Trim() ?? string.Empty,
            Location = dto.Location?.Trim() ?? string.Empty,
            Source = string.IsNullOrWhiteSpace(dto.Source) ? "Website Inbound" : dto.Source.Trim(),
            Status = string.IsNullOrWhiteSpace(dto.Status) ? "New" : dto.Status.Trim(),
            Priority = string.IsNullOrWhiteSpace(dto.Priority) ? "Medium" : dto.Priority.Trim(),
            Notes = dto.Notes?.Trim() ?? string.Empty,
            TargetDevelopment = dto.TargetDevelopment?.Trim(),
            BudgetRange = dto.BudgetRange?.Trim(),
            ReadyToRegister = dto.ReadyToRegister?.Trim(),
            CustomFieldsJson = customFields.Count > 0 ? JsonSerializer.Serialize(customFields) : null,
            CreatedAt = DateTime.UtcNow
        };

        _context.Leads.Add(lead);
        await _context.SaveChangesAsync(ct);

        // Reload agent navigation for DTO
        await _context.Entry(lead).Reference(l => l.AssignedAgent).LoadAsync(ct);

        return ApiResponse<LeadResponseDto>.SuccessResult(MapToDto(lead), "Lead created successfully.");
    }

    public async Task<ApiResponse<LeadResponseDto>> UpdateLeadAsync(int id, UpdateLeadDto dto, CancellationToken ct = default)
    {
        var lead = await FindScopedLeadAsync(id, ct);
        if (lead == null)
            return ApiResponse<LeadResponseDto>.FailureResult("Lead not found or access denied.");

        if (dto.Name != null) lead.Name = dto.Name.Trim();
        if (dto.Phone != null) lead.Phone = dto.Phone.Trim();
        if (dto.Email != null) lead.Email = dto.Email.Trim();
        if (dto.Location != null) lead.Location = dto.Location.Trim();
        if (dto.Source != null) lead.Source = dto.Source.Trim();
        if (dto.Priority != null) lead.Priority = dto.Priority.Trim();
        if (dto.Status != null)
        {
            var requestedStatus = dto.Status.Trim();
            if (lead.CompanyId == 2 && string.Equals(requestedStatus, "Converted", StringComparison.OrdinalIgnoreCase) && !string.Equals(lead.Status, "Converted", StringComparison.OrdinalIgnoreCase))
            {
                var hasVerifiedBooking = await _context.JaminBookings
                    .Include(b => b.Payments)
                    .AnyAsync(b => b.LeadId == lead.Id &&
                                   b.Status != "Cancelled" && b.Status != "Voided" &&
                                   (b.PaymentStatus == "Verified" || b.Payments.Any(p => p.Status == "Verified" && p.PaymentType != "Refund")), ct);

                if (!hasVerifiedBooking)
                {
                    return ApiResponse<LeadResponseDto>.FailureResult("In Jamin Bazaar, leads cannot be converted via generic lead edit. Conversion requires an active plot booking with a verified token payment.");
                }
            }
            lead.Status = requestedStatus;

            // Synchronize linked site visits when lead status changes
            var leadPhone = lead.Phone?.Trim();
            var visits = await _context.SiteVisits
                .Where(s => s.TenantId == lead.CompanyId && (s.LeadId == lead.Id || (!string.IsNullOrEmpty(leadPhone) && s.CustomerPhone == leadPhone)))
                .ToListAsync(ct);

            if (string.Equals(requestedStatus, "Site Visit Completed", StringComparison.OrdinalIgnoreCase))
            {
                foreach (var v in visits.Where(v => v.Status != "Cancelled"))
                {
                    v.Status = "Completed";
                    v.UpdatedAt = DateTime.UtcNow;
                }
            }
            else if (string.Equals(requestedStatus, "Site Visit Scheduled", StringComparison.OrdinalIgnoreCase))
            {
                foreach (var v in visits.Where(v => v.Status == "Pending" || v.Status == "Requested"))
                {
                    v.Status = "Scheduled";
                    v.UpdatedAt = DateTime.UtcNow;
                }
            }
        }
        if (dto.Notes != null) lead.Notes = dto.Notes.Trim();
        if (dto.TargetDevelopment != null) lead.TargetDevelopment = dto.TargetDevelopment.Trim();
        if (dto.BudgetRange != null) lead.BudgetRange = dto.BudgetRange.Trim();
        if (dto.ReadyToRegister != null) lead.ReadyToRegister = dto.ReadyToRegister.Trim();
        if (dto.NextFollowupDate.HasValue) lead.NextFollowupDate = dto.NextFollowupDate.Value;
        if (dto.AssignedAgentId.HasValue)
        {
            if (string.Equals(_currentUser.Role, "sales_executive", StringComparison.OrdinalIgnoreCase) &&
                dto.AssignedAgentId.Value != _currentUser.UserId)
                return ApiResponse<LeadResponseDto>.FailureResult("Sales agents cannot reassign leads.");

            var agent = await _context.Users.FirstOrDefaultAsync(
                u => u.Id == dto.AssignedAgentId.Value && u.CompanyId == lead.CompanyId, ct);
            if (agent == null)
                return ApiResponse<LeadResponseDto>.FailureResult("The selected agent or manager does not belong to this company.");
            lead.AssignedAgentId = agent.Id;
            lead.AssignedAgentName = agent.Name;
        }

        // Merge custom fields
        var customFields = DeserializeCustomFields(lead.CustomFieldsJson);
        if (dto.InvestmentCapacity != null) customFields["investmentCapacity"] = dto.InvestmentCapacity;
        if (dto.AssetClass != null) customFields["assetClass"] = dto.AssetClass;
        if (dto.PreferredAssetClass != null) customFields["preferredAssetClass"] = dto.PreferredAssetClass;
        if (dto.Horizon != null) customFields["horizon"] = dto.Horizon;
        if (dto.DispositionReason != null) customFields["dispositionReason"] = dto.DispositionReason;
        if (dto.AdditionalCustomFields != null)
        {
            foreach (var kvp in dto.AdditionalCustomFields)
                customFields[kvp.Key] = kvp.Value;
        }

        lead.CustomFieldsJson = customFields.Count > 0 ? JsonSerializer.Serialize(customFields) : null;
        lead.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(ct);

        return ApiResponse<LeadResponseDto>.SuccessResult(MapToDto(lead), "Lead updated successfully.");
    }

    public async Task<ApiResponse<object>> ConvertLeadAsync(int id, ConvertLeadDto dto, CancellationToken ct = default)
    {
        var lead = await FindScopedLeadAsync(id, ct);
        if (lead == null)
            return ApiResponse<object>.FailureResult("Lead not found or access denied.");

        if (lead.CompanyId == 2)
        {
            var hasVerifiedBooking = await _context.JaminBookings
                .Include(b => b.Payments)
                .AnyAsync(b => b.LeadId == lead.Id &&
                               b.Status != "Cancelled" && b.Status != "Voided" &&
                               (b.PaymentStatus == "Verified" || b.Payments.Any(p => p.Status == "Verified" && p.PaymentType != "Refund")), ct);

            if (!hasVerifiedBooking)
            {
                return ApiResponse<object>.FailureResult(
                    "In Jamin Bazaar, leads cannot bypass the verified booking workflow. Lead-to-customer conversion requires an active plot booking with a verified token payment. Please formalize a booking and verify the token payment to convert this lead.");
            }
        }

        Customer? customer = null;
        var strategy = _context.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await _context.Database.BeginTransactionAsync(ct);
            var agentId = lead.AssignedAgentId;
            var companyId = lead.CompanyId;

            // Check if customer already exists with this phone
            customer = await _context.Customers
                .FirstOrDefaultAsync(c => c.Phone == lead.Phone && c.CompanyId == companyId, ct);

            if (customer == null)
            {
                customer = new Customer
                {
                    CompanyId = companyId,
                    AssignedAgentId = lead.AssignedAgentId,
                    Name = lead.Name,
                    Phone = lead.Phone,
                    Email = lead.Email,
                    Location = lead.Location,
                    Status = "Active",
                    TotalValue = dto.DealValue ?? 0,
                    Notes = dto.Notes ?? lead.Notes,
                    CustomFieldsJson = lead.CustomFieldsJson,
                    LastContactedAt = DateTime.UtcNow,
                    CreatedAt = DateTime.UtcNow
                };
                _context.Customers.Add(customer);
                await _context.SaveChangesAsync(ct);
            }
            else
            {
                if (string.IsNullOrWhiteSpace(customer.Name)) customer.Name = lead.Name;
                if (string.IsNullOrWhiteSpace(customer.Email)) customer.Email = lead.Email;
                if (string.IsNullOrWhiteSpace(customer.Location)) customer.Location = lead.Location;
                if (string.IsNullOrWhiteSpace(customer.Notes)) customer.Notes = dto.Notes ?? lead.Notes;
                if (customer.AssignedAgentId == null) customer.AssignedAgentId = lead.AssignedAgentId;
                customer.LastContactedAt = DateTime.UtcNow;
                if (dto.DealValue.HasValue)
                {
                    customer.TotalValue += dto.DealValue.Value;
                }
            }

            lead.Status = "Converted";
            lead.UpdatedAt = DateTime.UtcNow;

            // Link existing call records for this lead to the customer
            var cleanLeadPhone = new string(lead.Phone.Where(char.IsDigit).ToArray());
            var last10LeadPhone = cleanLeadPhone.Length >= 10 ? cleanLeadPhone[^10..] : cleanLeadPhone;

            var leadCalls = await _context.CallRecords
                .Where(c => c.LeadId == lead.Id ||
                            (!string.IsNullOrEmpty(last10LeadPhone) && c.ContactPhone.Contains(last10LeadPhone)) ||
                            c.ContactPhone == lead.Phone)
                .ToListAsync(ct);
            foreach (var call in leadCalls)
            {
                call.CustomerId = customer.Id;
                call.LeadId = lead.Id;
            }

            // Link existing followups for this lead to the customer
            var leadFollowups = await _context.Followups
                .Where(f => (f.ContactId == lead.Id.ToString() || f.LeadId == lead.Id) && f.CompanyId == companyId)
                .ToListAsync(ct);
            foreach (var fu in leadFollowups)
            {
                fu.CustomerId = customer.Id;
                fu.ContactType = "customer";
                fu.ContactId = customer.Id.ToString();
            }

            var leadSiteVisits = await _context.SiteVisits
                .Where(s => s.LeadId == lead.Id && s.TenantId == companyId)
                .ToListAsync(ct);
            foreach (var visit in leadSiteVisits)
            {
                visit.CustomerId = customer.Id;
                visit.ContactType = "customer";
            }

            var leadBookings = await _context.JaminBookings
                .Where(b => b.LeadId == lead.Id && b.CompanyId == companyId)
                .ToListAsync(ct);
            foreach (var booking in leadBookings)
                booking.CustomerId = customer.Id;

            var leadNotifications = await _context.Notifications
                .Where(n => n.LeadId == lead.Id && n.CompanyId == companyId)
                .ToListAsync(ct);
            foreach (var notification in leadNotifications)
                notification.CustomerId = customer.Id;

            var leadAuditLogs = await _context.AuditLogs
                .Where(a => a.LeadId == lead.Id && a.CompanyId == companyId)
                .ToListAsync(ct);
            foreach (var auditLog in leadAuditLogs)
                auditLog.CustomerId = customer.Id;

            await _context.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
        });

        return ApiResponse<object>.SuccessResult(new
        {
            customerId = customer?.Id ?? 0,
            leadId = lead.Id,
            status = "Converted"
        }, "Lead converted to Customer 360 successfully.");
    }

    public async Task<ApiResponse<PagedResult<LeadResponseDto>>> GetNotInterestedLeadsAsync(int page, int pageSize, CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = GetScopedLeadsQuery()
            .Where(l => l.Status == "Not Interested")
            .OrderByDescending(l => l.UpdatedAt ?? l.CreatedAt);

        var totalCount = await query.CountAsync(ct);
        var entities = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        var items = entities.Select(MapToDto).ToList();

        return ApiResponse<PagedResult<LeadResponseDto>>.SuccessResult(
            PagedResult<LeadResponseDto>.Create(items, totalCount, page, pageSize),
            "Not Interested leads retrieved.");
    }

    public async Task<ApiResponse<PagedResult<LeadResponseDto>>> GetJunkLeadsAsync(int page, int pageSize, CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = GetScopedLeadsQuery()
            .Where(l => l.Status == "Junk")
            .OrderByDescending(l => l.UpdatedAt ?? l.CreatedAt);

        var totalCount = await query.CountAsync(ct);
        var entities = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        var items = entities.Select(MapToDto).ToList();

        return ApiResponse<PagedResult<LeadResponseDto>>.SuccessResult(
            PagedResult<LeadResponseDto>.Create(items, totalCount, page, pageSize),
            "Junk leads retrieved.");
    }

    public async Task<ApiResponse<LeadResponseDto>> ReengageLeadAsync(int id, CancellationToken ct = default)
    {
        var lead = await FindScopedLeadAsync(id, ct);
        if (lead == null)
            return ApiResponse<LeadResponseDto>.FailureResult("Lead not found or access denied.");

        lead.Status = "Contacted";
        lead.UpdatedAt = DateTime.UtcNow;

        // Clear stale pending followups for this lead
        var leadIdStr = lead.Id.ToString();
        var staleFollowups = await _context.Followups
            .Where(f => f.CompanyId == lead.CompanyId &&
                        f.ContactId == leadIdStr &&
                        f.ContactType == "lead" &&
                        f.Status == FollowupStatus.Pending)
            .ToListAsync(ct);

        if (staleFollowups.Any())
        {
            _context.Followups.RemoveRange(staleFollowups);
        }

        // Schedule fresh followup for tomorrow
        var tomorrow = DateTime.UtcNow.Date.AddDays(1).AddHours(10); // 10:00 AM UTC tomorrow
        var freshFollowup = new Followup
        {
            CompanyId = lead.CompanyId,
            AssignedAgentId = lead.AssignedAgentId,
            LeadId = lead.Id,
            ContactId = lead.Id.ToString(),
            ContactType = "lead",
            ContactName = lead.Name,
            ContactPhone = lead.Phone,
            ScheduledAt = tomorrow,
            Priority = "High",
            Status = FollowupStatus.Pending,
            Notes = "Re-engaged lead follow-up reminder.",
            CreatedAt = DateTime.UtcNow
        };
        _context.Followups.Add(freshFollowup);
        lead.NextFollowupDate = tomorrow;

        await _context.SaveChangesAsync(ct);

        return ApiResponse<LeadResponseDto>.SuccessResult(MapToDto(lead), "Lead re-engaged and follow-up scheduled.");
    }

    private static LeadResponseDto MapToDto(Lead lead)
    {
        var customFieldsDict = DeserializeCustomFields(lead.CustomFieldsJson);
        if (!string.IsNullOrEmpty(lead.ReadyToRegister)) customFieldsDict["readyToRegister"] = lead.ReadyToRegister;
        if (!string.IsNullOrEmpty(lead.BudgetRange)) customFieldsDict["budgetRange"] = lead.BudgetRange;
        if (!string.IsNullOrEmpty(lead.TargetDevelopment)) customFieldsDict["targetDevelopment"] = lead.TargetDevelopment;

        return new LeadResponseDto
        {
            Id = lead.Id,
            CompanyId = lead.CompanyId,
            AssignedAgentId = lead.AssignedAgentId,
            AssignedAgentName = lead.AssignedAgent?.Name ?? lead.AssignedAgentName,
            Name = lead.Name,
            Phone = lead.Phone,
            Email = lead.Email,
            Location = lead.Location,
            Source = lead.Source,
            Status = lead.Status,
            Priority = lead.Priority,
            Notes = lead.Notes,
            TargetDevelopment = lead.TargetDevelopment,
            BudgetRange = lead.BudgetRange,
            ReadyToRegister = lead.ReadyToRegister,
            PreferredVisitDate = lead.PreferredVisitDate,
            PreferredTimeSlot = lead.PreferredTimeSlot,
            AnythingWeShouldKnow = lead.AnythingWeShouldKnow,
            WhatAreYouLookingFor = lead.WhatAreYouLookingFor,
            CustomFields = customFieldsDict,
            NextFollowupDate = lead.NextFollowupDate,
            CreatedAt = lead.CreatedAt,
            UpdatedAt = lead.UpdatedAt
        };
    }

    private static Dictionary<string, string> DeserializeCustomFields(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new Dictionary<string, string>();
        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, string>>(json) ?? new Dictionary<string, string>();
        }
        catch
        {
            return new Dictionary<string, string>();
        }
    }

    public async Task<ApiResponse<object>> DeleteLeadAsync(int id, CancellationToken ct = default)
    {
        var lead = await FindScopedLeadAsync(id, ct);
        if (lead == null) return ApiResponse<object>.FailureResult("Lead not found or access denied.");

        _context.Leads.Remove(lead);
        await _context.SaveChangesAsync(ct);

        return ApiResponse<object>.SuccessResult(true, "Lead deleted successfully.");
    }
}

