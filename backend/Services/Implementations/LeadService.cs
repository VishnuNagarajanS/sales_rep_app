using System.Collections.Concurrent;
using System.Text.Json;
using backend.Helpers;
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
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> _leadCreationLocks = new();

    public LeadService(ApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    private static readonly string[] ExcludedStatuses = { "Not Interested", "Junk", "Converted" };

    public static string? NormalizePhone(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone)) return null;
        var digits = new string(phone.Where(char.IsDigit).ToArray());
        if (digits.Length >= 10) return digits[^10..];
        if (digits.Length >= 7) return digits;
        return null;
    }

    public static string? NormalizeEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email)) return null;
        var clean = email.Trim().ToLowerInvariant();
        return string.IsNullOrEmpty(clean) ? null : clean;
    }

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

        if (role == "super_admin")
        {
            var targetCompanyId = requestedCompanyId ?? companyId;
            if (targetCompanyId.HasValue)
                query = query.Where(l => l.CompanyId == targetCompanyId.Value);
            return query;
        }

        var effectiveCompanyId = companyId ?? requestedCompanyId;
        if (effectiveCompanyId.HasValue)
        {
            query = query.Where(l => l.CompanyId == effectiveCompanyId.Value);
        }

        if ((role == "sales_executive" || role == "irm") && agentId.HasValue)
        {
            query = query.Where(l => l.AssignedAgentId == agentId.Value);
        }

        return query;
    }

    private async Task<Lead?> FindScopedLeadAsync(int id, CancellationToken ct)
    {
        var role = _currentUser.Role;
        var agentId = _currentUser.UserId;
        var companyId = _currentUser.CompanyId;

        var query = _context.Leads.Include(l => l.AssignedAgent).Where(l => l.Id == id);

        if (role == "super_admin")
        {
            return await query.FirstOrDefaultAsync(ct);
        }

        if (companyId.HasValue)
        {
            query = query.Where(l => l.CompanyId == companyId.Value);
        }

        if ((role == "sales_executive" || role == "irm") && agentId.HasValue)
        {
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

        return ApiResponse<LeadResponseDto>.SuccessResult(MapToDto(lead));
    }

    public async Task<ApiResponse<LeadResponseDto>> CreateLeadAsync(CreateLeadDto dto, CancellationToken ct = default)
    {
        var agentId = _currentUser.UserId;
        if (!agentId.HasValue || agentId.Value <= 0)
            return ApiResponse<LeadResponseDto>.FailureResult("Unauthorized: User ID is missing.");

        var companyId = dto.CompanyId ?? _currentUser.CompanyId;
        if (!companyId.HasValue || companyId.Value <= 0)
            return ApiResponse<LeadResponseDto>.FailureResult("Unauthorized: Company ID is missing.");

        // Build Custom Fields Dictionary for GHL
        var customFields = dto.AdditionalCustomFields ?? new Dictionary<string, string>();
        
        var cap = OptionalFieldNormalizer.Normalize(dto.InvestmentCapacity);
        if (cap != null) customFields["investmentCapacity"] = cap;

        var rawAsset = dto.AssetClass ?? dto.PreferredAssetClass;
        var rawPref = dto.PreferredAssetClass ?? dto.AssetClass;
        var normAsset = OptionalFieldNormalizer.Normalize(rawAsset);
        var normPref = OptionalFieldNormalizer.Normalize(rawPref);
        
        if (normAsset != null) customFields["assetClass"] = normAsset;
        if (normPref != null) customFields["preferredAssetClass"] = normPref;

        if (!string.IsNullOrWhiteSpace(dto.Horizon)) customFields["horizon"] = dto.Horizon;

        // Canonical Customer Duplicate Check: check normalized phone (last 10 digits) and normalized email
        var normPhone = NormalizePhone(dto.Phone);
        var normEmail = NormalizeEmail(dto.Email);
        var hasIdentifier = normPhone != null || normEmail != null;

        var targetAgentId = (dto.AssignedAgentId.HasValue && dto.AssignedAgentId.Value > 0)
            ? dto.AssignedAgentId.Value
            : agentId.Value;

        var role = _currentUser.Role;

        // Concurrency lock to prevent race conditions when two simultaneous requests create the same contact
        var lockKey = hasIdentifier ? $"{companyId.Value}:{normPhone ?? normEmail}" : null;
        SemaphoreSlim? semaphore = null;
        if (lockKey != null)
        {
            semaphore = _leadCreationLocks.GetOrAdd(lockKey, _ => new SemaphoreSlim(1, 1));
            await semaphore.WaitAsync(ct);
        }

        try
        {
            Lead? existingLead = null;
            Customer? existingCustomer = null;
            Followup? matchingPendingFollowup = null;
            List<Followup> companyFollowups = new();

            if (hasIdentifier)
            {
                var companyLeads = await _context.Leads
                    .Include(l => l.AssignedAgent)
                    .Where(l => l.CompanyId == companyId.Value)
                    .ToListAsync(ct);

                existingLead = companyLeads.FirstOrDefault(l =>
                {
                    var lEmail = NormalizeEmail(l.Email);
                    if (normEmail != null && lEmail != null && lEmail == normEmail) return true;

                    var lPhone = NormalizePhone(l.Phone);
                    if (normPhone != null && lPhone != null && lPhone == normPhone) return true;

                    return false;
                });

                var companyCustomers = await _context.Customers
                    .Include(c => c.AssignedAgent)
                    .Where(c => c.CompanyId == companyId.Value)
                    .ToListAsync(ct);

                existingCustomer = companyCustomers.FirstOrDefault(c =>
                {
                    var cEmail = NormalizeEmail(c.Email);
                    if (normEmail != null && cEmail != null && cEmail == normEmail) return true;

                    var cPhone = NormalizePhone(c.Phone);
                    if (normPhone != null && cPhone != null && cPhone == normPhone) return true;

                    return false;
                });

                companyFollowups = await _context.Followups
                    .Include(f => f.AssignedAgent)
                    .Where(f => f.CompanyId == companyId.Value && f.Status == FollowupStatus.Pending)
                    .ToListAsync(ct);

                matchingPendingFollowup = companyFollowups.FirstOrDefault(f =>
                {
                    var fPhone = NormalizePhone(f.ContactPhone);
                    if (normPhone != null && fPhone != null && fPhone == normPhone) return true;

                    if (existingLead != null && f.ContactType == "lead" && f.ContactId == existingLead.Id.ToString()) return true;
                    if (existingCustomer != null && f.ContactType == "customer" && f.ContactId == existingCustomer.Id.ToString()) return true;

                    return false;
                });
            }

            // Detect if the contact already exists in Follow-up
            var isLeadInFollowup = existingLead != null && (
                existingLead.Status == "Follow-up Required" ||
                (matchingPendingFollowup != null && matchingPendingFollowup.ContactType == "lead" && matchingPendingFollowup.ContactId == existingLead.Id.ToString()) ||
                (existingLead.NextFollowupDate.HasValue && existingLead.NextFollowupDate.Value > DateTime.UtcNow.AddDays(-30))
            );

            var isCustomerInFollowup = existingCustomer != null && (
                matchingPendingFollowup != null ||
                companyFollowups.Any(f => f.ContactType == "customer" && f.ContactId == existingCustomer.Id.ToString())
            );

            var existsInFollowup = isLeadInFollowup || isCustomerInFollowup || matchingPendingFollowup != null;

            if (existsInFollowup)
            {
                var contactName = existingLead?.Name ?? existingCustomer?.Name ?? matchingPendingFollowup?.ContactName ?? dto.Name;
                var assignedAgentName = existingLead?.AssignedAgent?.Name ?? existingCustomer?.AssignedAgent?.Name ?? matchingPendingFollowup?.AssignedAgent?.Name ?? "an assigned agent";
                var assignedAgentId = existingLead?.AssignedAgentId ?? existingCustomer?.AssignedAgentId ?? matchingPendingFollowup?.AssignedAgentId ?? 0;
                var contactType = existingCustomer != null ? "customer" : "lead";
                var contactId = existingCustomer != null ? existingCustomer.Id.ToString() : (existingLead?.Id.ToString() ?? matchingPendingFollowup?.ContactId ?? "");
                var contactPhone = existingLead?.Phone ?? existingCustomer?.Phone ?? matchingPendingFollowup?.ContactPhone ?? dto.Phone;
                var contactEmail = existingLead?.Email ?? existingCustomer?.Email ?? dto.Email ?? string.Empty;

                var failureMsg = $"Customer \"{contactName}\" already exists in Follow-up (assigned to {assignedAgentName}).";
                var failureErrors = new List<string>
                {
                    "DUPLICATE_IN_FOLLOWUP",
                    $"CONTACT_ID:{contactId}",
                    $"CONTACT_TYPE:{contactType}",
                    $"CONTACT_NAME:{contactName}",
                    $"CONTACT_PHONE:{contactPhone}",
                    $"CONTACT_EMAIL:{contactEmail}",
                    $"ASSIGNED_AGENT:{assignedAgentName}",
                    $"ASSIGNED_AGENT_ID:{assignedAgentId}"
                };

                var failResult = ApiResponse<LeadResponseDto>.FailureResult(failureMsg, failureErrors);
                if (existingLead != null)
                {
                    failResult.Data = MapToDto(existingLead);
                }
                return failResult;
            }

            // If matching record is an existing Customer, do not create a duplicate Lead
            if (existingCustomer != null)
            {
                var custAssignedTo = existingCustomer.AssignedAgent?.Name ?? "another agent";
                return ApiResponse<LeadResponseDto>.FailureResult(
                    $"A customer already exists with this contact information: {existingCustomer.Name} ({existingCustomer.Phone} / {existingCustomer.Email}), currently assigned to {custAssignedTo}.",
                    new List<string>
                    {
                        "DUPLICATE_CUSTOMER",
                        $"CONTACT_ID:{existingCustomer.Id}",
                        $"CONTACT_TYPE:customer",
                        $"CONTACT_NAME:{existingCustomer.Name}",
                        $"CONTACT_PHONE:{existingCustomer.Phone}",
                        $"CONTACT_EMAIL:{existingCustomer.Email}",
                        $"ASSIGNED_AGENT:{custAssignedTo}",
                        $"ASSIGNED_AGENT_ID:{existingCustomer.AssignedAgentId}"
                    });
            }

            // If matching record is an existing Lead (not in follow-up)
            if (existingLead != null)
            {
                // If already assigned to the current user (e.g. IRM), update and reuse the canonical record without overwriting follow-up state
                if (existingLead.AssignedAgentId == targetAgentId)
                {
                    if (!string.IsNullOrWhiteSpace(dto.Name)) existingLead.Name = dto.Name.Trim();
                    if (!string.IsNullOrWhiteSpace(dto.Location)) existingLead.Location = dto.Location.Trim();
                    if (!string.IsNullOrWhiteSpace(dto.Notes)) existingLead.Notes = dto.Notes.Trim();
                    if (!string.IsNullOrWhiteSpace(dto.Priority)) existingLead.Priority = dto.Priority.Trim();

                    // Preserve existing status if already in an active workflow
                    if (existingLead.Status == "New" || string.IsNullOrWhiteSpace(existingLead.Status))
                    {
                        if (role == "irm")
                        {
                            existingLead.Status = "Interested";
                        }
                        else if (!string.IsNullOrWhiteSpace(dto.Status))
                        {
                            existingLead.Status = dto.Status.Trim();
                        }
                    }
                    else if (role != "irm" && !string.IsNullOrWhiteSpace(dto.Status) && dto.Status.Trim() != "New")
                    {
                        existingLead.Status = dto.Status.Trim();
                    }

                    if (customFields.Count > 0)
                    {
                        var existingFields = DeserializeCustomFields(existingLead.CustomFieldsJson);
                        foreach (var kvp in customFields) existingFields[kvp.Key] = kvp.Value;
                        existingLead.CustomFieldsJson = JsonSerializer.Serialize(existingFields);
                    }

                    existingLead.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync(ct);

                    return ApiResponse<LeadResponseDto>.SuccessResult(MapToDto(existingLead), "Existing lead updated and ready in your active list.");
                }

                var assignedTo = existingLead.AssignedAgent?.Name ?? "another agent";
                return ApiResponse<LeadResponseDto>.FailureResult(
                    $"A lead already exists with this contact information: {existingLead.Name} ({existingLead.Phone} / {existingLead.Email}), currently assigned to {assignedTo}.",
                    new List<string> { "Duplicate contact information" });
            }

            var defaultStatus = role == "irm" ? "Interested" : "New";
            var finalStatus = string.IsNullOrWhiteSpace(dto.Status) ? defaultStatus : (role == "irm" && dto.Status.Trim() == "New" ? "Interested" : dto.Status.Trim());

            var lead = new Lead
            {
                CompanyId = companyId.Value,
                AssignedAgentId = targetAgentId,
                Name = dto.Name.Trim(),
                Phone = dto.Phone.Trim(),
                Email = dto.Email?.Trim() ?? string.Empty,
                Location = dto.Location?.Trim() ?? string.Empty,
                Source = string.IsNullOrWhiteSpace(dto.Source) ? "Website Inbound" : dto.Source.Trim(),
                Status = finalStatus,
                Priority = string.IsNullOrWhiteSpace(dto.Priority) ? "Medium" : dto.Priority.Trim(),
                Notes = dto.Notes?.Trim() ?? string.Empty,
                CustomFieldsJson = customFields.Count > 0 ? JsonSerializer.Serialize(customFields) : null,
                CreatedAt = DateTime.UtcNow
            };

            _context.Leads.Add(lead);
            await _context.SaveChangesAsync(ct);

            // Reload agent navigation for DTO
            await _context.Entry(lead).Reference(l => l.AssignedAgent).LoadAsync(ct);

            return ApiResponse<LeadResponseDto>.SuccessResult(MapToDto(lead), "Lead created successfully.");
        }
        finally
        {
            if (semaphore != null)
            {
                semaphore.Release();
            }
        }
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
        if (dto.Status != null) lead.Status = dto.Status.Trim();
        if (dto.Priority != null) lead.Priority = dto.Priority.Trim();
        if (dto.Notes != null) lead.Notes = dto.Notes.Trim();
        if (dto.NextFollowupDate.HasValue) lead.NextFollowupDate = dto.NextFollowupDate.Value;
        if (dto.AssignedAgentId.HasValue) lead.AssignedAgentId = dto.AssignedAgentId.Value;

        // Merge custom fields
        var customFields = DeserializeCustomFields(lead.CustomFieldsJson);
        
        if (dto.InvestmentCapacity != null)
        {
            var cap = OptionalFieldNormalizer.Normalize(dto.InvestmentCapacity);
            if (cap == null) customFields.Remove("investmentCapacity");
            else customFields["investmentCapacity"] = cap;
        }
        
        if (dto.AssetClass != null || dto.PreferredAssetClass != null)
        {
            var rawAsset = dto.AssetClass ?? dto.PreferredAssetClass;
            var rawPref = dto.PreferredAssetClass ?? dto.AssetClass;
            var normAsset = OptionalFieldNormalizer.Normalize(rawAsset);
            var normPref = OptionalFieldNormalizer.Normalize(rawPref);
            
            if (normAsset == null) customFields.Remove("assetClass"); else customFields["assetClass"] = normAsset;
            if (normPref == null) customFields.Remove("preferredAssetClass"); else customFields["preferredAssetClass"] = normPref;
        }
        
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

        var agentId = lead.AssignedAgentId;
        var companyId = lead.CompanyId;

        // Check if customer already exists with this phone
        var customer = await _context.Customers
            .FirstOrDefaultAsync(c => c.Phone == lead.Phone && c.CompanyId == companyId, ct);

        if (customer == null)
        {
            customer = new Customer
            {
                CompanyId = companyId,
                AssignedAgentId = agentId ?? 1,
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
        }
        else
        {
            customer.LastContactedAt = DateTime.UtcNow;
            if (dto.DealValue.HasValue)
            {
                customer.TotalValue += dto.DealValue.Value;
            }
        }

        lead.Status = "Converted";
        lead.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(ct);

        return ApiResponse<object>.SuccessResult(new
        {
            customerId = customer.Id,
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
            AssignedAgentId = lead.AssignedAgentId ?? 1,
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
        return new LeadResponseDto
        {
            Id = lead.Id,
            CompanyId = lead.CompanyId,
            AssignedAgentId = lead.AssignedAgentId,
            AssignedAgentName = lead.AssignedAgent?.Name,
            Name = lead.Name,
            Phone = lead.Phone,
            Email = lead.Email,
            Location = lead.Location,
            Source = lead.Source,
            Status = lead.Status,
            Priority = lead.Priority,
            Notes = lead.Notes,
            CustomFields = DeserializeCustomFields(lead.CustomFieldsJson),
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
}
