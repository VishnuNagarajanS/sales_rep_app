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
    private readonly IIrmOtherService _otherService;
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> _leadCreationLocks = new();

    private readonly backend.Services.Interfaces.ICompanyClock _clock;

    public LeadService(
        ApplicationDbContext context, 
        ICurrentUserService currentUser, 
        backend.Services.Interfaces.ICompanyClock clock,
        IIrmOtherService? otherService = null)
    {
        _context = context;
        _currentUser = currentUser;
        _clock = clock;
        _otherService = otherService ?? new IrmOtherService(context);
    }

    public LeadService(
        ApplicationDbContext context, 
        ICurrentUserService currentUser, 
        IIrmOtherService? otherService = null)
        : this(context, currentUser, new backend.Services.Implementations.CompanyClock(), otherService)
    {
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
        var role = (_currentUser.Role ?? string.Empty).ToLowerInvariant();
        var agentId = _currentUser.UserId;
        var companyId = _currentUser.CompanyId;

        // Do not trust tenant/company ID supplied by the browser when authenticated claims determine it
        int? effectiveCompanyId = (companyId.HasValue && companyId.Value > 0)
            ? companyId.Value
            : (role == "super_admin" ? (filter?.CompanyId ?? (filter?.CompanySlug == "jamin" || filter?.CompanySlug == "2" ? 2 : 1)) : null);

        var query = _context.Leads.AsNoTracking()
            .Include(l => l.AssignedAgent)
                .ThenInclude(u => u!.Role)
            .Include(l => l.AssignedBy)
            .Include(l => l.OriginalOwner)
            .Include(l => l.Handover)
            .AsQueryable();

        if (role == "super_admin")
        {
            if (effectiveCompanyId.HasValue)
                query = query.Where(l => l.CompanyId == effectiveCompanyId.Value);
            return query;
        }

        if (effectiveCompanyId.HasValue)
        {
            query = query.Where(l => l.CompanyId == effectiveCompanyId.Value);
        }

        if (role == "irm" && agentId.HasValue)
        {
            // In IRM My Leads, show a lead only when its status is exactly Interested,
            // its assigned agent ID matches the logged-in IRM, and company matches
            query = query.Where(l => l.AssignedAgentId == agentId.Value && l.Status == "Interested");
        }
        else if (role == "sales_executive" && agentId.HasValue)
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

        var query = _context.Leads.Include(l => l.AssignedAgent).Include(l => l.AssignedBy).Where(l => l.Id == id);

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

        if (_currentUser.Role == "company_admin" || _currentUser.Role == "super_admin")
        {
            if (string.Equals(filter.Assignment, "unassigned", StringComparison.OrdinalIgnoreCase))
                query = query.Where(l => l.AssignedAgentId == null || l.AssignedAgent!.Role.Code == "company_admin" || l.AssignedAgent!.Role.Code == "super_admin");
            else if (string.Equals(filter.Assignment, "assigned", StringComparison.OrdinalIgnoreCase))
                query = query.Where(l => l.AssignedAgentId != null && l.AssignedAgent!.Role.Code != "company_admin" && l.AssignedAgent!.Role.Code != "super_admin");
        }

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
            query = query.Where(l => l.Status != "Not Interested" && l.Status != "Junk" && l.Status != "Follow-up Required" && l.Status != "Converted");
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

        var companyId = _currentUser.CompanyId ?? 1;
        var otherMatcher = await _otherService.GetOtherMatcherAsync(companyId, "my_leads", ct);

        // Sorting
        var isAsc = string.Equals(filter.SortOrder, "asc", StringComparison.OrdinalIgnoreCase);
        query = (filter.SortBy?.ToLower()) switch
        {
            "name" => isAsc ? query.OrderBy(l => l.Name) : query.OrderByDescending(l => l.Name),
            "status" => isAsc ? query.OrderBy(l => l.Status) : query.OrderByDescending(l => l.Status),
            "priority" => isAsc ? query.OrderBy(l => l.Priority) : query.OrderByDescending(l => l.Priority),
            _ => isAsc ? query.OrderBy(l => l.CreatedAt) : query.OrderByDescending(l => l.CreatedAt),
        };

        var entities = await query.ToListAsync(ct);

        if (otherMatcher.HasAnyOther)
        {
            entities = entities
                .Where(l => !otherMatcher.IsInOther(l.Phone, null, l.Id, l.Name))
                .ToList();
        }

        var totalCount = entities.Count;
        var page = Math.Max(1, filter.Page);
        var pageSize = Math.Clamp(filter.PageSize, 1, 100);

        var paged = entities
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        var items = paged.Select(MapToDto).ToList();

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
        var role = _currentUser.Role;

        int companyId;
        if (role == "super_admin")
        {
            if (dto.CompanyId.HasValue) companyId = dto.CompanyId.Value;
            else if (_currentUser.CompanyId.HasValue) companyId = _currentUser.CompanyId.Value;
            else return ApiResponse<LeadResponseDto>.FailureResult("Company ID is required.");
        }
        else
        {
            if (!_currentUser.CompanyId.HasValue)
                return ApiResponse<LeadResponseDto>.FailureResult("User is not associated with a company.");
            companyId = _currentUser.CompanyId.Value;
        }

        // S3: Validate the caller has a user identity before writing anything.
        var callerId = _currentUser.UserId;
        if (callerId == null)
            return ApiResponse<LeadResponseDto>.FailureResult("User not authenticated.");

        int? targetAgentId = null;
        DateTime? assignedAt = null;

        if (role == "sales_executive" || role == "irm")
        {
            targetAgentId = callerId;
            assignedAt = DateTime.UtcNow;
        }
        else if (role == "company_admin" || role == "super_admin")
        {
            if (dto.AssignedAgentId.HasValue && dto.AssignedAgentId.Value > 0)
            {
                // S3: Use company-aware clock, not DateTime.UtcNow, to avoid
                // midnight-UTC vs IST boundary incorrectly allowing on-leave agents.
                var today = await _clock.GetCompanyTodayAsync(companyId, ct);

                var targetUser = await _context.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.Id == dto.AssignedAgentId.Value && u.CompanyId == companyId, ct);
                if (targetUser != null && targetUser.Role?.Code == "sales_executive" && targetUser.Status == UserStatus.Active)
                {
                    var isOnLeave = await _context.LeaveRequests.AnyAsync(lr => lr.UserId == targetUser.Id && lr.Status == "Approved" && lr.StartDate <= today && lr.EndDate >= today, ct);
                    // S3: Match GhlLeadAssignmentController's handover check (scoped to same company).
                    var isCovered = await _context.WorkHandovers.AnyAsync(wh => wh.OriginalUserId == targetUser.Id && wh.CompanyId == companyId && wh.Status == "active", ct);

                    if (!isOnLeave && !isCovered)
                    {
                        targetAgentId = targetUser.Id;
                        assignedAt = DateTime.UtcNow;
                    }
                }
            }
        }


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
        if (!string.IsNullOrWhiteSpace(dto.InvestmentAmount)) customFields["investmentAmount"] = dto.InvestmentAmount.Trim();

        if (dto.AssignedIrmId.HasValue) customFields["assignedIrmId"] = dto.AssignedIrmId.Value.ToString();
        if (dto.AssignedIrmName != null) customFields["assignedIrmName"] = dto.AssignedIrmName.Trim();
        if (dto.AssignedIrmAt != null) customFields["assignedIrmAt"] = dto.AssignedIrmAt.Trim();
        else if (dto.AssignedIrmId.HasValue || dto.AssignedIrmName != null)
        {
            if (!customFields.ContainsKey("assignedIrmAt"))
                customFields["assignedIrmAt"] = DateTime.UtcNow.ToString("o");
        }

        // Canonical Customer Duplicate Check: check normalized phone (last 10 digits) and normalized email
        var normPhone = NormalizePhone(dto.Phone);
        var normEmail = NormalizeEmail(dto.Email);
        var hasIdentifier = normPhone != null || normEmail != null;

        // Concurrency lock to prevent race conditions when two simultaneous requests create the same contact
        var lockKey = hasIdentifier ? $"{companyId}:{normPhone ?? normEmail}" : null;
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
            InvestorKyc? matchingKyc = null;
            GhlDeal? matchingKycDeal = null;
            List<GhlDeal> companyDeals = new();

            if (hasIdentifier)
            {
                var companyLeads = await _context.Leads
                    .Include(l => l.AssignedAgent)
                    .Where(l => l.CompanyId == companyId && !l.IsDuplicate)
                    .ToListAsync(ct);

                existingLead = companyLeads.FirstOrDefault(l =>
                {
                    var lPhone = NormalizePhone(l.NormalizedPhone) ?? NormalizePhone(l.Phone);
                    if (normPhone != null && lPhone != null && lPhone == normPhone) return true;

                    var lEmail = NormalizeEmail(l.NormalizedEmail) ?? NormalizeEmail(l.Email);
                    if (normEmail != null && lEmail != null && lEmail == normEmail) return true;

                    return false;
                });

                var companyCustomers = await _context.Customers
                    .Include(c => c.AssignedAgent)
                    .Where(c => c.CompanyId == companyId && !c.IsDuplicate)
                    .ToListAsync(ct);

                existingCustomer = companyCustomers.FirstOrDefault(c =>
                {
                    var cPhone = NormalizePhone(c.NormalizedPhone) ?? NormalizePhone(c.Phone);
                    if (normPhone != null && cPhone != null && cPhone == normPhone) return true;

                    var cEmail = NormalizeEmail(c.NormalizedEmail) ?? NormalizeEmail(c.Email);
                    if (normEmail != null && cEmail != null && cEmail == normEmail) return true;

                    return false;
                });

                companyFollowups = await _context.Followups
                    .Include(f => f.AssignedAgent)
                    .Where(f => f.CompanyId == companyId && f.Status == FollowupStatus.Pending)
                    .ToListAsync(ct);

                matchingPendingFollowup = companyFollowups.FirstOrDefault(f =>
                {
                    var fPhone = NormalizePhone(f.ContactPhone);
                    if (normPhone != null && fPhone != null && fPhone == normPhone) return true;

                    if (existingLead != null && f.ContactType == "lead" && f.ContactId == existingLead.Id.ToString()) return true;
                    if (existingCustomer != null && f.ContactType == "customer" && f.ContactId == existingCustomer.Id.ToString()) return true;

                    return false;
                });

                // Fetch tenant-scoped KYC records
                var companyKycs = await _context.InvestorKycs
                    .Include(k => k.Irm)
                    .Where(k => k.CompanyId == companyId)
                    .ToListAsync(ct);

                matchingKyc = companyKycs.FirstOrDefault(k =>
                {
                    var kPhone = NormalizePhone(k.Phone);
                    if (normPhone != null && kPhone != null && kPhone == normPhone) return true;
                    var kEmail = NormalizeEmail(k.Email);
                    if (normEmail != null && kEmail != null && kEmail == normEmail) return true;
                    return false;
                });

                // Fetch tenant-scoped deals
                companyDeals = await _context.GhlDeals
                    .Include(d => d.AssignedAgent)
                    .Include(d => d.Customer)
                    .Where(d => d.CompanyId == companyId)
                    .ToListAsync(ct);

                matchingKycDeal = companyDeals.FirstOrDefault(d =>
                {
                    var isKycStage = d.Stage == "qualified_investor" || d.KycId != null || !string.IsNullOrWhiteSpace(d.KycStatus);
                    if (!isKycStage) return false;

                    if (existingCustomer != null && d.CustomerId == existingCustomer.Id) return true;
                    if (existingLead != null && d.CustomerId == existingLead.Id) return true;

                    if (d.Customer != null)
                    {
                        if (normPhone != null && d.Customer.NormalizedPhone == normPhone) return true;
                        if (normEmail != null && d.Customer.NormalizedEmail == normEmail) return true;
                    }

                    return false;
                });

                // IRM pipeline cards merged into GhlDeals
            }

            // 1. Authoritative Stage Detection: Check if contact is currently in KYC
            var isLeadInKyc = existingLead != null && (
                existingLead.Status == "Qualified" ||
                (existingLead.CustomFieldsJson != null && existingLead.CustomFieldsJson.Contains("\"movedToKycAt\""))
            );

            var isContactInKyc = matchingKyc != null || matchingKycDeal != null || isLeadInKyc;

            if (isContactInKyc)
            {
                // Synchronize stale lead status if it was previously set to Follow-up Required
                if (existingLead != null && existingLead.Status == "Follow-up Required")
                {
                    existingLead.Status = "Qualified";
                    existingLead.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync(ct);
                }

                var contactName = matchingKyc?.InvestorName
                    ?? matchingKycDeal?.CustomerName
                    ?? existingCustomer?.Name
                    ?? existingLead?.Name
                    ?? dto.Name;

                var assignedAgentName = matchingKyc?.Irm?.Name
                    ?? matchingKycDeal?.AssignedAgent?.Name
                    ?? existingCustomer?.AssignedAgent?.Name
                    ?? existingLead?.AssignedAgent?.Name
                    ?? "an assigned agent";

                var assignedAgentId = matchingKyc?.IrmId
                    ?? matchingKycDeal?.AssignedAgentId
                    ?? existingCustomer?.AssignedAgentId
                    ?? existingLead?.AssignedAgentId
                    ?? 0;

                var contactType = existingCustomer != null ? "customer" : "lead";
                var contactId = existingCustomer != null
                    ? existingCustomer.Id.ToString()
                    : (existingLead?.Id.ToString() ?? matchingKycDeal?.CustomerId?.ToString() ?? matchingKyc?.InvestorId.ToString() ?? "");
                var contactPhone = existingCustomer?.Phone ?? existingLead?.Phone ?? matchingKyc?.Phone ?? matchingKycDeal?.Customer?.Phone ?? dto.Phone;
                var contactEmail = existingCustomer?.Email ?? existingLead?.Email ?? matchingKyc?.Email ?? matchingKycDeal?.Customer?.Email ?? dto.Email ?? string.Empty;

                var kycId = matchingKyc?.Id.ToString() ?? matchingKycDeal?.KycId?.ToString() ?? "";
                var dealId = matchingKycDeal?.Id.ToString() ?? "";

                var failureMsg = $"Customer \"{contactName}\" already exists in KYC Onboarding (assigned to {assignedAgentName}).";
                var failureErrors = new List<string>
                {
                    "DUPLICATE_IN_KYC",
                    "STAGE:KYC",
                    $"CONTACT_ID:{contactId}",
                    $"CONTACT_TYPE:{contactType}",
                    $"CONTACT_NAME:{contactName}",
                    $"CONTACT_PHONE:{contactPhone}",
                    $"CONTACT_EMAIL:{contactEmail}",
                    $"ASSIGNED_AGENT:{assignedAgentName}",
                    $"ASSIGNED_AGENT_ID:{assignedAgentId}",
                    $"KYC_ID:{kycId}",
                    $"DEAL_ID:{dealId}"
                };

                var failResult = ApiResponse<LeadResponseDto>.FailureResult(failureMsg, failureErrors);
                if (existingLead != null)
                {
                    failResult.Data = MapToDto(existingLead);
                }
                return failResult;
            }

            // 2. Authoritative Stage Detection: Check if contact is genuinely in Follow-up
            // (Do not infer stage merely because a follow-up task exists for an investor/customer in another stage)
            var matchingFollowupDeal = companyDeals.FirstOrDefault(d =>
            {
                if (d.Stage != "followup") return false;
                if (existingCustomer != null && d.CustomerId == existingCustomer.Id) return true;
                if (existingLead != null && d.CustomerId == existingLead.Id) return true;
                if (d.Customer != null)
                {
                    if (normPhone != null && d.Customer.NormalizedPhone == normPhone) return true;
                    if (normEmail != null && d.Customer.NormalizedEmail == normEmail) return true;
                }
                return false;
            });

            var isLeadInFollowup = existingLead != null && (
                existingLead.Status == "Follow-up Required" ||
                (matchingPendingFollowup != null && matchingPendingFollowup.ContactType == "lead" && matchingPendingFollowup.ContactId == existingLead.Id.ToString())
            );

            var isCustomerInFollowup = existingCustomer != null && (
                (matchingPendingFollowup != null && matchingPendingFollowup.ContactType == "customer" && matchingPendingFollowup.ContactId == existingCustomer.Id.ToString()) ||
                companyFollowups.Any(f => f.ContactType == "customer" && f.ContactId == existingCustomer.Id.ToString())
            );

            var existsInFollowup = isLeadInFollowup || isCustomerInFollowup || matchingFollowupDeal != null || (existingCustomer == null && matchingPendingFollowup != null);

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
                CompanyId = companyId,
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

            // S3: Add the assignment history row before SaveChangesAsync so both
            // the lead and its history are committed atomically in one round-trip.
            if (targetAgentId.HasValue)
            {
                var history = new LeadAssignmentHistory
                {
                    Lead = lead,           // EF resolves LeadId from the navigation
                    ToAgentId = targetAgentId.Value,
                    AssignedById = callerId!.Value,
                    Method = "manual",
                    AssignedAt = assignedAt ?? DateTime.UtcNow
                };
                _context.LeadAssignmentHistories.Add(history);
            }

            await _context.SaveChangesAsync(ct);

            // Reload agent navigation for DTO
            if (lead.AssignedAgentId.HasValue)
            {
                await _context.Entry(lead).Reference(l => l.AssignedAgent).LoadAsync(ct);
            }

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

    /// <summary>
    /// Once a lead is qualified as 'Interested' its sales follow-up tasks are no longer needed.
    /// Cancels the lead's still-pending sales follow-ups so they drop off the Follow-ups page.
    /// (IRM follow-ups are left alone; they belong to the IRM who now works the lead.)
    /// </summary>
    private async Task CancelPendingSalesFollowupsAsync(Lead lead, CancellationToken ct)
    {
        var leadIdStr = lead.Id.ToString();
        var pending = await _context.Followups
            .Where(f => f.CompanyId == lead.CompanyId &&
                        f.ContactType == "lead" &&
                        f.ContactId == leadIdStr &&
                        f.Status == FollowupStatus.Pending &&
                        f.AssignedToRole != "irm")
            .ToListAsync(ct);

        foreach (var f in pending)
        {
            f.Status = FollowupStatus.Cancelled;
            f.OutcomeNotes = "Auto-closed: lead marked Interested.";
            f.UpdatedAt = DateTime.UtcNow;
        }
    }

    public async Task<ApiResponse<LeadResponseDto>> UpdateLeadAsync(int id, UpdateLeadDto dto, CancellationToken ct = default)
    {
        var lead = await FindScopedLeadAsync(id, ct);
        if (lead == null)
            return ApiResponse<LeadResponseDto>.FailureResult("Lead not found or access denied.");

        var previousStatus = lead.Status;

        if (dto.Name != null) lead.Name = dto.Name.Trim();

        // Duplicate protection on update: normalize phone/email and check against customers and other leads in tenant
        if (dto.Phone != null || dto.Email != null)
        {
            var candidatePhone = dto.Phone != null ? dto.Phone.Trim() : lead.Phone;
            var candidateEmail = dto.Email != null ? dto.Email.Trim() : lead.Email;
            var newNormPhone = NormalizePhone(candidatePhone);
            var newNormEmail = NormalizeEmail(candidateEmail);

            if (newNormPhone != null || newNormEmail != null)
            {
                var existingCustomer = await _context.Customers
                    .Include(c => c.AssignedAgent)
                    .FirstOrDefaultAsync(c =>
                        c.CompanyId == lead.CompanyId &&
                        !c.IsDuplicate &&
                        ((newNormPhone != null && c.NormalizedPhone == newNormPhone) ||
                         (newNormEmail != null && c.NormalizedEmail == newNormEmail)), ct);

                if (existingCustomer != null)
                {
                    return ApiResponse<LeadResponseDto>.FailureResult(
                        $"Cannot update lead: A customer already exists with this contact information: {existingCustomer.Name} ({existingCustomer.Phone} / {existingCustomer.Email}).");
                }

                var existingOtherLead = await _context.Leads
                    .Include(l => l.AssignedAgent)
                    .FirstOrDefaultAsync(l =>
                        l.CompanyId == lead.CompanyId &&
                        l.Id != lead.Id &&
                        !l.IsDuplicate &&
                        ((newNormPhone != null && l.NormalizedPhone == newNormPhone) ||
                         (newNormEmail != null && l.NormalizedEmail == newNormEmail)), ct);

                if (existingOtherLead != null)
                {
                    return ApiResponse<LeadResponseDto>.FailureResult(
                        $"Cannot update lead: Another lead already exists with this contact information: {existingOtherLead.Name} ({existingOtherLead.Phone} / {existingOtherLead.Email}).");
                }
            }

            if (dto.Phone != null) lead.Phone = dto.Phone.Trim();
            if (dto.Email != null) lead.Email = dto.Email.Trim();
            lead.NormalizedPhone = newNormPhone;
            lead.NormalizedEmail = newNormEmail;
        }

        if (dto.Location != null) lead.Location = dto.Location.Trim();
        if (dto.Source != null) lead.Source = dto.Source.Trim();
        if (dto.Status != null) lead.Status = dto.Status.Trim();
        if (lead.Status == "Interested" && previousStatus != "Interested")
            await CancelPendingSalesFollowupsAsync(lead, ct);
        if (dto.Priority != null) lead.Priority = dto.Priority.Trim();
        if (dto.Notes != null) lead.Notes = dto.Notes.Trim();
        if (dto.NextFollowupDate.HasValue) lead.NextFollowupDate = dto.NextFollowupDate.Value;
        
        if (dto.AssignedAgentId.HasValue && lead.AssignedAgentId != dto.AssignedAgentId.Value)
        {
            var oldAgentId = lead.AssignedAgentId;
            var newAgentId = dto.AssignedAgentId.Value;
            lead.AssignedAgentId = newAgentId;
            lead.AssignedById = _currentUser.UserId;
            lead.AssignedAt = DateTime.UtcNow;

            var pendingFollowups = await _context.Followups
                .Where(f => f.CompanyId == lead.CompanyId &&
                            (f.ContactId == lead.Id.ToString() || f.ContactPhone == lead.Phone) &&
                            f.Status == FollowupStatus.Pending)
                .ToListAsync(ct);
            if (pendingFollowups.Count > 0)
            {
                var newAgent = await _context.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.Id == newAgentId, ct);
                foreach (var f in pendingFollowups)
                {
                    f.AssignedAgentId = newAgentId;
                    if (newAgent != null)
                    {
                        f.AssignedToName = newAgent.Name;
                        f.AssignedToRole = newAgent.Role?.Code ?? f.AssignedToRole;
                    }
                    f.UpdatedAt = DateTime.UtcNow;
                }
            }

            if (_currentUser.UserId.HasValue)
            {
                _context.LeadAssignmentHistories.Add(new LeadAssignmentHistory
                {
                    LeadId = lead.Id,
                    FromAgentId = oldAgentId,
                    ToAgentId = newAgentId,
                    AssignedById = _currentUser.UserId.Value,
                    Method = "manual",
                    AssignedAt = DateTime.UtcNow
                });
            }
        }
        // Merge custom fields
        var customFields = DeserializeCustomFields(lead.CustomFieldsJson);
        
        if (dto.InvestmentCapacity != null)
        {
            var cap = OptionalFieldNormalizer.Normalize(dto.InvestmentCapacity);
            if (cap == null) customFields.Remove("investmentCapacity");
            else customFields["investmentCapacity"] = cap;
        }

        if (dto.InvestmentAmount != null)
        {
            if (string.IsNullOrWhiteSpace(dto.InvestmentAmount))
                customFields.Remove("investmentAmount");
            else
                customFields["investmentAmount"] = dto.InvestmentAmount.Trim();
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
        if (dto.AssignedIrmId.HasValue) customFields["assignedIrmId"] = dto.AssignedIrmId.Value.ToString();
        if (dto.AssignedIrmName != null) customFields["assignedIrmName"] = dto.AssignedIrmName.Trim();
        if (dto.AssignedIrmAt != null) customFields["assignedIrmAt"] = dto.AssignedIrmAt.Trim();
        else if (dto.AssignedIrmId.HasValue || dto.AssignedIrmName != null)
        {
            if (!customFields.ContainsKey("assignedIrmAt"))
                customFields["assignedIrmAt"] = DateTime.UtcNow.ToString("o");
        }
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

        // Check if customer already exists with normalized phone or email in this tenant
        var leadNormPhone = NormalizePhone(lead.Phone);
        var leadNormEmail = NormalizeEmail(lead.Email);

        Customer? customer = null;
        if (leadNormPhone != null || leadNormEmail != null)
        {
            customer = await _context.Customers.FirstOrDefaultAsync(c =>
                c.CompanyId == companyId &&
                !c.IsDuplicate &&
                ((leadNormPhone != null && c.NormalizedPhone == leadNormPhone) ||
                 (leadNormEmail != null && c.NormalizedEmail == leadNormEmail)), ct);
        }

        bool isNewCustomer = false;
        if (customer == null)
        {
            isNewCustomer = true;
            customer = new Customer
            {
                CompanyId = companyId,
                AssignedAgentId = agentId ?? _currentUser.UserId ?? throw new InvalidOperationException("User ID is required"),
                Name = lead.Name,
                Phone = lead.Phone,
                Email = lead.Email,
                NormalizedPhone = leadNormPhone,
                NormalizedEmail = leadNormEmail,
                IsDuplicate = false,
                Location = lead.Location,
                Status = "Active",
                TotalValue = dto.DealValue ?? 0,
                Notes = dto.Notes ?? lead.Notes,
                CustomFieldsJson = lead.CustomFieldsJson,
                LastContactedAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow,
                HandoverId = lead.HandoverId,
                OriginalOwnerId = lead.OriginalOwnerId
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

        if (isNewCustomer && customer.HandoverId.HasValue)
        {
            _context.WorkHandoverItems.Add(new WorkHandoverItem
            {
                HandoverId = customer.HandoverId.Value,
                EntityType = "Customer",
                EntityId = customer.Id,
                Origin = "created_during_coverage"
            });
            await _context.SaveChangesAsync(ct);
        }

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
        var tomorrow = (await _clock.GetTodayAsync(lead.CompanyId, ct)).AddDays(1).AddHours(10); // 10:00 AM local tomorrow
        var freshFollowup = new Followup
        {
            CompanyId = lead.CompanyId,
            AssignedAgentId = lead.AssignedAgentId ?? _currentUser.UserId ?? throw new InvalidOperationException("User ID is required"),
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
        var customFields = DeserializeCustomFields(lead.CustomFieldsJson);
        int? assignedIrmId = null;
        if (customFields.TryGetValue("assignedIrmId", out var irmIdStr) && int.TryParse(irmIdStr, out var parsedIrmId))
        {
            assignedIrmId = parsedIrmId;
        }

        string? assignedIrmName = customFields.TryGetValue("assignedIrmName", out var iname) ? iname : null;
        string? assignedIrmAt = customFields.TryGetValue("assignedIrmAt", out var iat) ? iat : null;

        return new LeadResponseDto
        {
            Id = lead.Id,
            CompanyId = lead.CompanyId,
            AssignedAgentId = lead.AssignedAgentId,
            AssignedAgentName = lead.AssignedAgent?.Name,
            AssignedIrmId = assignedIrmId,
            AssignedIrmName = assignedIrmName,
            AssignedIrmAt = assignedIrmAt,
            AssignedAt = lead.AssignedAt,
            AssignedById = lead.AssignedById,
            AssignedByName = (lead.AssignedBy != null && lead.AssignedById != lead.AssignedAgentId)
                ? lead.AssignedBy.Name
                : (lead.CustomFieldsJson != null && lead.CustomFieldsJson.Contains("qualifiedByAgentName")
                    ? DeserializeCustomFields(lead.CustomFieldsJson).GetValueOrDefault("qualifiedByAgentName")
                    : null),
            Name = lead.Name,
            Phone = lead.Phone,
            Email = lead.Email,
            Location = lead.Location,
            Source = lead.Source,
            Status = lead.Status,
            Priority = lead.Priority,
            Notes = lead.Notes,
            CustomFields = customFields,
            NextFollowupDate = lead.NextFollowupDate,
            CreatedAt = lead.CreatedAt,
            UpdatedAt = lead.UpdatedAt,
            HandoverId = lead.HandoverId,
            HandedOverFromName = lead.OriginalOwner?.Name,
            HandoverPlannedEnd = lead.Handover?.PlannedEndAt,
            OriginalOwnerId = lead.OriginalOwnerId
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

        return ApiResponse<object>.SuccessResult(new object(), "Lead deleted successfully.");
    }
}

