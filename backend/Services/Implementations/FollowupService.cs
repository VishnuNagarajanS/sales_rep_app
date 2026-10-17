using backend.Authentication.Interfaces;
using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.Followups;
using backend.Models.Entities;
using backend.Models.Enums;
using backend.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Implementations;

public class FollowupService : IFollowupService
{
    private readonly ApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;
    private readonly IIrmOtherService _otherService;

    public FollowupService(ApplicationDbContext context, ICurrentUserService currentUser, IIrmOtherService? otherService = null)
    {
        _context = context;
        _currentUser = currentUser;
        _otherService = otherService ?? new IrmOtherService(context);
    }

    private IQueryable<Followup> GetScopedFollowupsQuery(int? requestedCompanyId = null)
    {
        var role = _currentUser.Role;
        var agentId = _currentUser.UserId;
        var tokenCompanyId = _currentUser.CompanyId;
        var isSuperAdmin = string.Equals(role, "super_admin", StringComparison.OrdinalIgnoreCase);
        var canViewCompanyFollowups = isSuperAdmin ||
            string.Equals(role, "company_admin", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase);
        var targetCompanyId = isSuperAdmin ? requestedCompanyId ?? tokenCompanyId : tokenCompanyId;

        var query = _context.Followups.AsNoTracking()
            .Include(f => f.AssignedAgent)
                .ThenInclude(a => a!.Role)
            .Include(f => f.OriginalOwner)
            .Include(f => f.Handover)
            .AsQueryable();

        if (isSuperAdmin)
        {
            if (targetCompanyId.HasValue)
                query = query.Where(f => f.CompanyId == targetCompanyId.Value);
            if (targetCompanyId == 2)
                query = query.Where(f => f.ContactType != "investor" && f.InvestorId == null);
            return query;
        }

        if (!targetCompanyId.HasValue)
            return query.Where(_ => false);

        query = query.Where(f => f.CompanyId == targetCompanyId.Value);

        if (targetCompanyId == 2)
        {
            // Jamin Bazaar is real estate only — no investor or IRM follow-ups
            query = query.Where(f => f.ContactType != "investor" && f.InvestorId == null);
        }

        if (!canViewCompanyFollowups)
        {
            if (agentId.HasValue)
            {
                var cid = targetCompanyId ?? 1;
                query = query.Where(f =>
                    f.AssignedAgentId == agentId.Value ||
                    _context.Leads.Any(l => l.CompanyId == cid && l.AssignedAgentId == agentId.Value &&
                        ((f.ContactId != null && f.ContactId != "" && f.ContactId == l.Id.ToString()) ||
                         (f.ContactPhone != null && f.ContactPhone != "" && (f.ContactPhone == l.Phone || f.ContactPhone.Contains(l.Phone) || l.Phone.Contains(f.ContactPhone)))))
                );
            }
            else
            {
                query = query.Where(_ => false);
            }
        }

        return query;
    }

    private bool IsGhlAdmin()
    {
        var role = (_currentUser.Role ?? string.Empty).ToLowerInvariant();
        var companyId = _currentUser.CompanyId;
        return (companyId == 1 || !companyId.HasValue) &&
               (role == "admin" || role == "ghl_admin" || role == "company_admin" || role == "super_admin");
    }

    private static bool IsIrmFollowup(Followup f)
    {
        if (string.Equals(f.AssignedToRole, "irm", StringComparison.OrdinalIgnoreCase))
            return true;
        if (string.Equals(f.ContactType, "investor", StringComparison.OrdinalIgnoreCase))
            return true;
        if (f.InvestorId.HasValue && f.InvestorId.Value > 0)
            return true;
        if (f.AssignedAgent?.Role != null &&
            (string.Equals(f.AssignedAgent.Role.Code, "irm", StringComparison.OrdinalIgnoreCase) ||
             string.Equals(f.AssignedAgent.Role.Name, "IRM", StringComparison.OrdinalIgnoreCase)))
            return true;
        return false;
    }

    private async Task<Followup?> FindScopedFollowupAsync(int id, CancellationToken ct)
    {
        var role = _currentUser.Role;
        var agentId = _currentUser.UserId;
        var companyId = _currentUser.CompanyId;

        var query = _context.Followups
            .Include(f => f.AssignedAgent)
                .ThenInclude(a => a!.Role)
            .Include(f => f.OriginalOwner)
            .Include(f => f.Handover)
            .Where(f => f.Id == id);

        if (string.Equals(role, "super_admin", StringComparison.OrdinalIgnoreCase))
        {
            return await query.FirstOrDefaultAsync(ct);
        }

        if (!companyId.HasValue)
            return null;

        query = query.Where(f => f.CompanyId == companyId.Value);

        if (companyId == 2)
        {
            query = query.Where(f => f.ContactType != "investor" && f.InvestorId == null);
        }

        var canViewCompanyFollowups =
            string.Equals(role, "company_admin", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase);
        if (!canViewCompanyFollowups)
        {
            if (!agentId.HasValue) return null;
            var cid = companyId ?? 1;
            query = query.Where(f =>
                f.AssignedAgentId == agentId.Value ||
                _context.Leads.Any(l => l.CompanyId == cid && l.AssignedAgentId == agentId.Value &&
                    ((f.ContactId != null && f.ContactId != "" && f.ContactId == l.Id.ToString()) ||
                     (f.ContactPhone != null && f.ContactPhone != "" && (f.ContactPhone == l.Phone || f.ContactPhone.Contains(l.Phone) || l.Phone.Contains(f.ContactPhone)))))
            );
        }

        return await query.FirstOrDefaultAsync(ct);
    }

    public async Task<ApiResponse<PagedResult<FollowupResponseDto>>> GetFollowupsAsync(FollowupFilterDto filter, CancellationToken ct = default)
    {
        var query = GetScopedFollowupsQuery(filter.CompanyId);

        // Status filter
        if (!string.IsNullOrWhiteSpace(filter.Status) && !filter.Status.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            if (Enum.TryParse<FollowupStatus>(filter.Status, true, out var stFilter))
            {
                query = query.Where(f => f.Status == stFilter);
            }
        }

        // Agent filter
        if (filter.AgentId.HasValue && filter.AgentId.Value > 0)
        {
            query = query.Where(f => f.AssignedAgentId == filter.AgentId.Value);
        }

        // Contact ID filter
        if (!string.IsNullOrWhiteSpace(filter.ContactId))
        {
            var cid = filter.ContactId.Trim();
            query = query.Where(f => f.ContactId == cid);
        }

        // Direct primary key filters
        if (filter.LeadId.HasValue && filter.LeadId.Value > 0)
        {
            query = query.Where(f => f.LeadId == filter.LeadId.Value);
        }

        if (filter.CustomerId.HasValue && filter.CustomerId.Value > 0)
        {
            query = query.Where(f => f.CustomerId == filter.CustomerId.Value);
        }

        // Contact Type filter
        if (!string.IsNullOrWhiteSpace(filter.ContactType))
        {
            var ctType = filter.ContactType.Trim().ToLower();
            query = query.Where(f => f.ContactType.ToLower() == ctType);
        }

        // Search filter
        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var s = filter.Search.Trim().ToLower();
            query = query.Where(f => f.ContactName.ToLower().Contains(s) || f.ContactPhone.Contains(s) || f.Notes.ToLower().Contains(s));
        }

        // Scope filter ('all', 'due', 'overdue')
        var now = DateTime.UtcNow;
        var todayStart = now.Date;
        var tomorrowStart = todayStart.AddDays(1);

        if (!string.IsNullOrWhiteSpace(filter.Scope))
        {
            var scope = filter.Scope.Trim().ToLower();
            if (scope == "due")
            {
                query = query.Where(f => f.ScheduledAt >= todayStart && f.ScheduledAt < tomorrowStart &&
                    (f.Status == FollowupStatus.Pending || f.Status == FollowupStatus.Rescheduled));
            }
            else if (scope == "overdue")
            {
                query = query.Where(f => f.ScheduledAt < now &&
                    (f.Status == FollowupStatus.Pending || f.Status == FollowupStatus.Rescheduled));
            }
        }

        var companyId = _currentUser.CompanyId ?? 1;
        var otherMatcher = await _otherService.GetOtherMatcherAsync(companyId, "follow_up", ct);

        var entities = await query
            .OrderBy(f => f.Status == FollowupStatus.Completed ? 1 : 0)
            .ThenByDescending(f => f.ScheduledAt)
            .ToListAsync(ct);

        if (otherMatcher.HasAnyOther)
        {
            entities = entities
                .Where(f =>
                {
                    int? lid = f.LeadId;
                    if (!lid.HasValue && !string.IsNullOrEmpty(f.ContactId))
                    {
                        var cleanContactId = f.ContactId.Replace("lead-", "").Trim();
                        if (int.TryParse(cleanContactId, out var parsedLid))
                            lid = parsedLid;
                    }
                    return !otherMatcher.IsInOther(f.ContactPhone, f.InvestorId, lid, f.ContactName);
                })
                .ToList();
        }

        // ── Stage isolation: auto-complete stale pending follow-ups for contacts
        // who have already advanced to KYC/Opportunities/Converted.
        // A followup is "stale" when the associated lead's status is no longer
        // in the Follow-up stage (i.e., Qualified, Converted, Not Interested, Junk)
        // or a Deal exists in KYC or Opportunities stages.
        var pendingEntities = entities.Where(f => f.Status == FollowupStatus.Pending).ToList();
        if (pendingEntities.Count > 0)
        {
            var pendingContactIds = pendingEntities.Where(f => !string.IsNullOrEmpty(f.ContactId)).Select(f => f.ContactId).Distinct().ToList();
            var pendingContactPhones = pendingEntities.Where(f => !string.IsNullOrEmpty(f.ContactPhone)).Select(f => f.ContactPhone).Distinct().ToList();

            // Statuses that mean the lead has moved beyond Follow-up stage
            var promotedStatuses = new[] { "Qualified", "KYC In Progress", "In Opportunity", "Converted", "Not Interested", "Junk" };

            var promotedLeads = await _context.Leads
                .AsNoTracking()
                .Where(l => l.CompanyId == companyId && promotedStatuses.Contains(l.Status))
                .Select(l => new { LeadId = l.Id.ToString(), l.Phone, l.Name, l.Status })
                .ToListAsync(ct);

            // Also check if there's a KYC-stage or higher deal for these contacts
            var kycAndAboveStages = new[] { "qualified_investor", "qualified", "investment_opportunity", "opportunity", "term_sheet", "committed", "converted", "won" };
            var kycDeals = await _context.GhlDeals
                .AsNoTracking()
                .Include(d => d.Customer)
                .Where(d => d.CompanyId == companyId && kycAndAboveStages.Contains(d.Stage))
                .Select(d => new { 
                    CustomerId = d.CustomerId.HasValue ? d.CustomerId.Value.ToString() : null,
                    d.CustomerName, 
                    Phone = d.Customer != null ? d.Customer.Phone : null 
                })
                .ToListAsync(ct);

            var kycRecords = await _context.InvestorKycs
                .AsNoTracking()
                .Where(k => k.CompanyId == companyId)
                .Select(k => new { k.Phone, k.InvestorName })
                .ToListAsync(ct);

            var promotedContactIds = new HashSet<string>(
                promotedLeads.Select(l => l.LeadId)
                .Concat(kycDeals.Where(d => d.CustomerId != null).Select(d => d.CustomerId!))
            );

            var promotedPhones = new HashSet<string>(
                promotedLeads.Where(l => !string.IsNullOrEmpty(l.Phone)).Select(l => l.Phone.Length >= 10 ? l.Phone[^10..] : l.Phone)
                .Concat(kycDeals.Where(d => !string.IsNullOrEmpty(d.Phone)).Select(d => d.Phone!.Length >= 10 ? d.Phone![^10..] : d.Phone!))
                .Concat(kycRecords.Where(k => !string.IsNullOrEmpty(k.Phone)).Select(k => k.Phone.Length >= 10 ? k.Phone[^10..] : k.Phone))
            );

            var promotedNames = new HashSet<string>(
                promotedLeads.Where(l => !string.IsNullOrWhiteSpace(l.Name)).Select(l => l.Name.Trim().ToLower())
                .Concat(kycDeals.Where(d => !string.IsNullOrWhiteSpace(d.CustomerName)).Select(d => d.CustomerName.Trim().ToLower()))
                .Concat(kycRecords.Where(k => !string.IsNullOrWhiteSpace(k.InvestorName)).Select(k => k.InvestorName.Trim().ToLower()))
            );

            var staleFollowups = pendingEntities.Where(f =>
            {
                if (!string.IsNullOrEmpty(f.ContactId) && promotedContactIds.Contains(f.ContactId)) return true;
                var fp10 = !string.IsNullOrEmpty(f.ContactPhone) && f.ContactPhone.Length >= 10 ? f.ContactPhone[^10..] : f.ContactPhone ?? "";
                if (!string.IsNullOrEmpty(fp10) && promotedPhones.Contains(fp10)) return true;
                var fname = (f.ContactName ?? "").Trim().ToLower();
                if (!string.IsNullOrEmpty(fname) && promotedNames.Contains(fname)) return true;
                return false;
            }).ToList();

            if (staleFollowups.Count > 0)
            {
                // Load them as tracked entities and mark as Completed
                var staleIds = staleFollowups.Select(f => f.Id).ToList();
                var trackedStale = await _context.Followups
                    .Where(f => staleIds.Contains(f.Id))
                    .ToListAsync(ct);
                foreach (var stale in trackedStale)
                {
                    stale.Status = FollowupStatus.Completed;
                    stale.CompletedAt = DateTime.UtcNow;
                    stale.UpdatedAt = DateTime.UtcNow;
                    if (!string.IsNullOrWhiteSpace(stale.Notes) && !stale.Notes.Contains("Auto-completed"))
                        stale.Notes += " | Auto-completed: contact advanced to KYC/Opportunity stage";
                    else if (string.IsNullOrWhiteSpace(stale.Notes))
                        stale.Notes = "Auto-completed: contact advanced to KYC/Opportunity stage";
                }
                await _context.SaveChangesAsync(ct);

                // Remove them from the in-memory list so they don't appear in results
                entities = entities.Where(f => !staleIds.Contains(f.Id)).ToList();
            }
        }

        var totalCount = entities.Count;
        var page = Math.Max(1, filter.Page);
        var pageSize = Math.Clamp(filter.PageSize, 1, 100);

        var paged = entities
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        var contactPhones = paged.Where(f => !string.IsNullOrEmpty(f.ContactPhone)).Select(f => f.ContactPhone).Distinct().ToList();
        var contactIds = paged.Where(f => !string.IsNullOrEmpty(f.ContactId)).Select(f => f.ContactId).Distinct().ToList();

        var matchedLeads = await _context.Leads
            .AsNoTracking()
            .Include(l => l.AssignedBy)
            .Include(l => l.AssignedAgent)
            .Where(l => l.CompanyId == companyId && (contactIds.Contains(l.Id.ToString()) || contactPhones.Contains(l.Phone)))
            .ToListAsync(ct);

        var fIds = paged.Select(f => f.Id).ToList();
        var returnedFItems = await _context.WorkHandoverItems
            .AsNoTracking()
            .Include(whi => whi.Handover).ThenInclude(wh => wh!.CoveringUser)
            .Where(whi => whi.EntityType == "Followup" && fIds.Contains(whi.EntityId) && whi.ReturnOutcome == "returned")
            .OrderByDescending(whi => whi.ReturnedAt)
            .ToListAsync(ct);
        var returnedByF = returnedFItems.GroupBy(i => i.EntityId).ToDictionary(g => g.Key, g => g.First());

        var items = paged.Select(f =>
        {
            Lead? lead = null;
            if (!string.IsNullOrWhiteSpace(f.ContactId))
                lead = matchedLeads.FirstOrDefault(l => l.Id.ToString() == f.ContactId);
            if (lead == null && !string.IsNullOrWhiteSpace(f.ContactPhone))
            {
                var p10 = f.ContactPhone.Length >= 10 ? f.ContactPhone[^10..] : f.ContactPhone;
                lead = matchedLeads.FirstOrDefault(l => l.Phone.Contains(p10));
            }
            var dto = MapToDto(f, lead);
            if (returnedByF.TryGetValue(f.Id, out var retItem))
            {
                dto.IsReturnedFromHandover = true;
                dto.ReturnedFromCoveringUserName = retItem.Handover?.CoveringUser?.Name;
                dto.ReturnedAt = retItem.ReturnedAt;
            }
            return dto;
        }).ToList();

        return ApiResponse<PagedResult<FollowupResponseDto>>.SuccessResult(
            PagedResult<FollowupResponseDto>.Create(items, totalCount, page, pageSize),
            "Follow-ups retrieved successfully.");
    }


    public async Task<ApiResponse<FollowupResponseDto>> GetFollowupByIdAsync(int id, CancellationToken ct = default)
    {
        var followup = await FindScopedFollowupAsync(id, ct);
        if (followup == null)
            return ApiResponse<FollowupResponseDto>.FailureResult("Follow-up not found or access denied.");

        Lead? lead = null;
        if (!string.IsNullOrWhiteSpace(followup.ContactId) && int.TryParse(followup.ContactId, out var cid))
        {
            lead = await _context.Leads.AsNoTracking().Include(l => l.AssignedBy).Include(l => l.AssignedAgent).FirstOrDefaultAsync(l => l.Id == cid, ct);
        }
        else if (!string.IsNullOrWhiteSpace(followup.ContactPhone))
        {
            var p10 = followup.ContactPhone.Length >= 10 ? followup.ContactPhone[^10..] : followup.ContactPhone;
            lead = await _context.Leads.AsNoTracking().Include(l => l.AssignedBy).Include(l => l.AssignedAgent).FirstOrDefaultAsync(l => l.CompanyId == followup.CompanyId && l.Phone.Contains(p10), ct);
        }

        return ApiResponse<FollowupResponseDto>.SuccessResult(MapToDto(followup, lead));
    }

    public async Task<ApiResponse<FollowupResponseDto>> CreateFollowupAsync(CreateFollowupDto dto, CancellationToken ct = default)
    {
        if (IsGhlAdmin() && string.Equals(dto.ContactType, "investor", StringComparison.OrdinalIgnoreCase))
        {
            return ApiResponse<FollowupResponseDto>.FailureResult("Access denied: GHL Admin has read-only access to IRM follow-up data.");
        }

        var role = _currentUser.Role;
        var isSuperAdmin = string.Equals(role, "super_admin", StringComparison.OrdinalIgnoreCase);
        var companyId = isSuperAdmin ? dto.CompanyId ?? _currentUser.CompanyId ?? 1 : _currentUser.CompanyId ?? 0;
        if (companyId <= 0)
            return ApiResponse<FollowupResponseDto>.FailureResult("A valid company is required to schedule a follow-up.");

        var contactType = string.IsNullOrWhiteSpace(dto.ContactType) ? "lead" : dto.ContactType.Trim().ToLowerInvariant();
        var contactId = dto.ContactId?.Trim() ?? string.Empty;
        int? leadId = dto.LeadId is > 0 ? dto.LeadId : null;
        int? customerId = dto.CustomerId is > 0 ? dto.CustomerId : null;
        int? investorId = dto.InvestorId is > 0 ? dto.InvestorId : null;
        if ((leadId.HasValue ? 1 : 0) + (customerId.HasValue ? 1 : 0) + (investorId.HasValue ? 1 : 0) > 1)
            return ApiResponse<FollowupResponseDto>.FailureResult("A follow-up can be linked to only one lead, customer, or investor.");

        if (leadId.HasValue)
        {
            if (!await _context.Leads.AnyAsync(l => l.Id == leadId.Value && l.CompanyId == companyId, ct))
                return ApiResponse<FollowupResponseDto>.FailureResult("Select a lead from this company before scheduling a follow-up.");
            contactType = "lead";
            contactId = leadId.Value.ToString();
        }
        else if (customerId.HasValue)
        {
            if (!await _context.Customers.AnyAsync(c => c.Id == customerId.Value && c.CompanyId == companyId, ct))
                return ApiResponse<FollowupResponseDto>.FailureResult("Select a customer from this company before scheduling a follow-up.");
            contactType = "customer";
            contactId = customerId.Value.ToString();
        }
        else if (investorId.HasValue)
        {
            if (!await _context.Investors.AnyAsync(i => i.Id == investorId.Value && i.CompanyId == companyId, ct))
                return ApiResponse<FollowupResponseDto>.FailureResult("Select an investor from this company before scheduling a follow-up.");
            contactType = "investor";
            contactId = investorId.Value.ToString();
        }
        else if (contactType == "lead")
        {
            if (!int.TryParse(contactId, out var parsedLeadId) ||
                !await _context.Leads.AnyAsync(l => l.Id == parsedLeadId && l.CompanyId == companyId, ct))
                return ApiResponse<FollowupResponseDto>.FailureResult("Select a lead from this company before scheduling a follow-up.");
            leadId = parsedLeadId;
        }
        else if (contactType == "customer")
        {
            if (!int.TryParse(contactId, out var parsedCustomerId) ||
                !await _context.Customers.AnyAsync(c => c.Id == parsedCustomerId && c.CompanyId == companyId, ct))
                return ApiResponse<FollowupResponseDto>.FailureResult("Select a customer from this company before scheduling a follow-up.");
            customerId = parsedCustomerId;
        }
        else if (contactType == "investor")
        {
            if (!int.TryParse(contactId, out var parsedInvestorId) ||
                !await _context.Investors.AnyAsync(i => i.Id == parsedInvestorId && i.CompanyId == companyId, ct))
                return ApiResponse<FollowupResponseDto>.FailureResult("Select an investor from this company before scheduling a follow-up.");
            investorId = parsedInvestorId;
        }
        else if (contactType != "new")
        {
            return ApiResponse<FollowupResponseDto>.FailureResult("Contact type must be lead, customer, investor, or new.");
        }

        // Deduplicate rapid resubmissions within 60 seconds
        var cleanContactId = contactId;
        var cleanNotes = (dto.Notes ?? string.Empty).Trim();
        var scheduledAtUtc = dto.ScheduledAt.Kind switch
        {
            DateTimeKind.Utc => dto.ScheduledAt,
            DateTimeKind.Local => dto.ScheduledAt.ToUniversalTime(),
            _ => DateTime.SpecifyKind(dto.ScheduledAt, DateTimeKind.Utc)
        };

        var existingPending = await _context.Followups
            .Include(f => f.AssignedAgent)
            .ThenInclude(a => a!.Role)
            .Where(f =>
                f.CompanyId == companyId &&
                f.Status == FollowupStatus.Pending &&
                f.ContactId == cleanContactId &&
                f.ScheduledAt == scheduledAtUtc &&
                f.Notes == cleanNotes &&
                f.CreatedAt >= DateTime.UtcNow.AddSeconds(-60))
            .FirstOrDefaultAsync(ct);

        // Resolve target lead if this is a lead follow-up
        Lead? targetLead = null;
        if (contactType == "lead")
        {
            if (leadId.HasValue)
            {
                targetLead = await _context.Leads.Include(l => l.AssignedAgent).ThenInclude(a => a!.Role).Include(l => l.AssignedBy)
                    .FirstOrDefaultAsync(l => l.Id == leadId.Value && l.CompanyId == companyId, ct);
            }
            if (targetLead == null && !string.IsNullOrWhiteSpace(dto.ContactPhone))
            {
                var p10 = dto.ContactPhone.Length >= 10 ? dto.ContactPhone[^10..] : dto.ContactPhone;
                targetLead = await _context.Leads.Include(l => l.AssignedAgent).ThenInclude(a => a!.Role).Include(l => l.AssignedBy)
                    .FirstOrDefaultAsync(l => l.CompanyId == companyId && l.Phone.Contains(p10), ct);
            }
        }

        var isSalesExecutive = string.Equals(role, "sales_executive", StringComparison.OrdinalIgnoreCase);
        var targetAgentId = isSalesExecutive ? _currentUser.UserId : dto.AssignedAgentId ?? targetLead?.AssignedAgentId ?? _currentUser.UserId;
        User? assignedAgent = null;
        if (targetAgentId.HasValue && targetAgentId.Value > 0)
        {
            assignedAgent = await _context.Users.Include(u => u.Role).FirstOrDefaultAsync(
                u => u.Id == targetAgentId.Value && u.CompanyId == companyId, ct);
            if (assignedAgent == null)
                return ApiResponse<FollowupResponseDto>.FailureResult("The assigned user does not belong to this company.");
        }
        var targetRole = dto.AssignedToRole ?? assignedAgent?.Role?.Code ?? "sales_executive";
        var targetName = assignedAgent?.Name ?? string.Empty;

        if (existingPending != null)
        {
            if (IsIrmFollowup(existingPending) && IsGhlAdmin())
            {
                return ApiResponse<FollowupResponseDto>.FailureResult("Access denied: GHL Admin has read-only access to IRM follow-up data.");
            }

            // Reuse and update the existing active pending follow-up (idempotency)
            existingPending.ScheduledAt = scheduledAtUtc;
            if (!string.IsNullOrWhiteSpace(dto.Priority)) existingPending.Priority = dto.Priority.Trim();
            if (!string.IsNullOrWhiteSpace(dto.Notes)) existingPending.Notes = dto.Notes.Trim();
            if (!string.IsNullOrWhiteSpace(dto.ContactEmail)) existingPending.ContactEmail = dto.ContactEmail.Trim();
            existingPending.AssignedAgentId = assignedAgent?.Id ?? targetAgentId;
            existingPending.AssignedToRole = targetRole;
            existingPending.AssignedToName = targetName;
            existingPending.UpdatedAt = DateTime.UtcNow;

            if (targetLead != null)
            {
                targetLead.NextFollowupDate = existingPending.ScheduledAt;
                if (targetLead.Status == "New" || targetLead.Status == "Contacted" || targetLead.Status == "Callback" || targetLead.Status == "Interested")
                {
                    targetLead.Status = "Follow-up Required";
                    targetLead.UpdatedAt = DateTime.UtcNow;
                }
            }

            await _context.SaveChangesAsync(ct);
            try { await _context.Entry(existingPending).Reference(f => f.AssignedAgent).LoadAsync(ct); } catch { }
            return ApiResponse<FollowupResponseDto>.SuccessResult(MapToDto(existingPending, targetLead), "Existing pending follow-up updated.");
        }

        string? resolvedEmail = dto.ContactEmail?.Trim();
        if (string.IsNullOrEmpty(resolvedEmail))
        {
            if (targetLead != null)
            {
                resolvedEmail = targetLead.Email;
            }
            else if (customerId.HasValue || (int.TryParse(contactId, out var parsedCustId) && contactType == "customer"))
            {
                var cid = customerId ?? int.Parse(contactId);
                var cust = await _context.Customers.FirstOrDefaultAsync(c => c.Id == cid && c.CompanyId == companyId, ct);
                resolvedEmail = cust?.Email;
            }
        }

        var followup = new Followup
        {
            CompanyId = companyId,
            AssignedAgentId = assignedAgent?.Id ?? targetAgentId,
            AssignedAgent = assignedAgent,
            AssignedToName = !string.IsNullOrWhiteSpace(targetName) ? targetName : (assignedAgent?.Name ?? "Unassigned"),
            AssignedToRole = !string.IsNullOrWhiteSpace(targetRole) ? targetRole : (assignedAgent?.Role?.Name ?? "Sales Executive"),
            ContactId = cleanContactId,
            ContactType = contactType,
            LeadId = leadId,
            CustomerId = customerId,
            InvestorId = investorId,
            ContactName = dto.ContactName?.Trim() ?? string.Empty,
            ContactPhone = dto.ContactPhone?.Trim() ?? string.Empty,
            ContactEmail = resolvedEmail ?? string.Empty,
            ScheduledAt = scheduledAtUtc,
            Priority = string.IsNullOrWhiteSpace(dto.Priority) ? "Medium" : dto.Priority.Trim(),
            Status = FollowupStatus.Pending,
            Notes = dto.Notes?.Trim() ?? string.Empty,
            FollowupType = string.IsNullOrWhiteSpace(dto.FollowupType) ? "call" : dto.FollowupType.Trim().ToLower(),
            CreatedAt = DateTime.UtcNow
        };

        // Deduplicate: If an active pending follow-up already exists for this contact, update it in place instead of creating a duplicate row!
        var cleanPhone10 = dto.ContactPhone?.Length >= 10 ? dto.ContactPhone[^10..] : dto.ContactPhone ?? string.Empty;
        var existingOldPending = await _context.Followups
            .Where(f =>
                f.CompanyId == companyId &&
                f.Status == FollowupStatus.Pending &&
                ((f.ContactId != null && f.ContactId != "" && f.ContactId != "contact-new" && f.ContactId == cleanContactId) ||
                 (cleanPhone10 != "" && f.ContactPhone != null && f.ContactPhone.Contains(cleanPhone10))))
            .ToListAsync(ct);

        if (existingOldPending.Count > 0)
        {
            var primaryFollowup = existingOldPending.First();
            primaryFollowup.ScheduledAt = scheduledAtUtc;
            if (!string.IsNullOrWhiteSpace(dto.Priority)) primaryFollowup.Priority = dto.Priority.Trim();
            if (!string.IsNullOrWhiteSpace(dto.Notes)) primaryFollowup.Notes = dto.Notes.Trim();
            if (!string.IsNullOrWhiteSpace(resolvedEmail)) primaryFollowup.ContactEmail = resolvedEmail;
            primaryFollowup.AssignedAgentId = assignedAgent?.Id ?? targetAgentId;
            primaryFollowup.AssignedToRole = targetRole;
            primaryFollowup.AssignedToName = targetName;
            primaryFollowup.UpdatedAt = DateTime.UtcNow;
            if (leadId.HasValue) primaryFollowup.LeadId = leadId;
            if (customerId.HasValue) primaryFollowup.CustomerId = customerId;
            if (investorId.HasValue) primaryFollowup.InvestorId = investorId;

            // Remove any other extra pending duplicate rows that may exist for this contact
            if (existingOldPending.Count > 1)
            {
                for (int i = 1; i < existingOldPending.Count; i++)
                {
                    _context.Followups.Remove(existingOldPending[i]);
                }
            }

            if (targetLead != null)
            {
                targetLead.NextFollowupDate = primaryFollowup.ScheduledAt;
                targetLead.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync(ct);
            try { await _context.Entry(primaryFollowup).Reference(f => f.AssignedAgent).LoadAsync(ct); } catch { }
            return ApiResponse<FollowupResponseDto>.SuccessResult(MapToDto(primaryFollowup, targetLead), "Follow-up rescheduled successfully.");
        }

        _context.Followups.Add(followup);

        // If this is for a Lead or Customer, check if parent is handed over
        int? inheritedHandoverId = targetLead?.HandoverId;
        int? inheritedOriginalOwnerId = targetLead?.OriginalOwnerId;

        if (targetLead != null)
        {
            targetLead.NextFollowupDate = followup.ScheduledAt;
            if (targetLead.Status == "New" || targetLead.Status == "Contacted" || targetLead.Status == "Callback" || targetLead.Status == "Interested" || targetLead.Status == "Follow-up Completed")
            {
                targetLead.Status = "Follow-up Required";
                targetLead.UpdatedAt = DateTime.UtcNow;
            }
        }
        else if (customerId.HasValue || (int.TryParse(followup.ContactId, out var custId) && followup.ContactType == "customer"))
        {
            var cid = customerId ?? int.Parse(followup.ContactId);
            var cust = await _context.Customers.FirstOrDefaultAsync(c => c.Id == cid && c.CompanyId == companyId, ct);
            if (cust != null)
            {
                inheritedHandoverId = cust.HandoverId;
                inheritedOriginalOwnerId = cust.OriginalOwnerId;
            }
        }

        followup.HandoverId = inheritedHandoverId;
        followup.OriginalOwnerId = inheritedOriginalOwnerId;

        await _context.SaveChangesAsync(ct);
        await RefreshLeadNextFollowupDateAsync(followup, ct);

        _context.AuditLogs.Add(new AuditLog
        {
            CompanyId = companyId,
            Timestamp = DateTime.UtcNow,
            ActorName = assignedAgent?.Name ?? (!string.IsNullOrWhiteSpace(_currentUser.Name) ? _currentUser.Name : (_currentUser.Email ?? "Agent")),
            ActorEmail = assignedAgent?.Email ?? _currentUser.Email ?? string.Empty,
            Action = "FOLLOWUP_SCHEDULED",
            EntityType = customerId.HasValue ? "Customer" : (leadId.HasValue ? "Lead" : "Followup"),
            EntityId = customerId.HasValue ? customerId.Value.ToString() : (leadId.HasValue ? leadId.Value.ToString() : followup.Id.ToString()),
            LeadId = leadId,
            CustomerId = customerId,
            Details = $"Scheduled {followup.FollowupType} follow-up for {followup.ContactName} on {followup.ScheduledAt:yyyy-MM-dd HH:mm} • Priority: {followup.Priority}{(string.IsNullOrWhiteSpace(followup.Notes) ? "" : $" • Notes: {followup.Notes}")}",
            Module = "Followups",
            Status = followup.Status.ToString()
        });
        await _context.SaveChangesAsync(ct);

        if (inheritedHandoverId.HasValue)
        {
            _context.WorkHandoverItems.Add(new WorkHandoverItem
            {
                HandoverId = inheritedHandoverId.Value,
                EntityType = "Followup",
                EntityId = followup.Id,
                Origin = "created_during_coverage",
                CreatedAt = DateTime.UtcNow
            });
            await _context.SaveChangesAsync(ct);
        }

        try
        {
            await _context.Entry(followup).Reference(f => f.AssignedAgent).LoadAsync(ct);
            if (inheritedHandoverId.HasValue)
            {
                await _context.Entry(followup).Reference(f => f.OriginalOwner).LoadAsync(ct);
                await _context.Entry(followup).Reference(f => f.Handover).LoadAsync(ct);
            }
        }
        catch { }

        return ApiResponse<FollowupResponseDto>.SuccessResult(MapToDto(followup, targetLead), "Follow-up scheduled successfully.");
    }

    public async Task<ApiResponse<FollowupResponseDto>> UpdateFollowupAsync(int id, UpdateFollowupDto dto, CancellationToken ct = default)
    {
        var followup = await FindScopedFollowupAsync(id, ct);
        if (followup == null)
            return ApiResponse<FollowupResponseDto>.FailureResult("Follow-up not found or access denied.");

        if (IsIrmFollowup(followup) && IsGhlAdmin())
        {
            return ApiResponse<FollowupResponseDto>.FailureResult("Access denied: GHL Admin has read-only access to IRM follow-up data.");
        }

        if (dto.ScheduledAt.HasValue)
        {
            var schedUtc = dto.ScheduledAt.Value.Kind switch
            {
                DateTimeKind.Utc => dto.ScheduledAt.Value,
                DateTimeKind.Local => dto.ScheduledAt.Value.ToUniversalTime(),
                _ => DateTime.SpecifyKind(dto.ScheduledAt.Value, DateTimeKind.Utc)
            };
            followup.ScheduledAt = schedUtc;
        }
        if (!string.IsNullOrWhiteSpace(dto.Priority)) followup.Priority = dto.Priority.Trim();
        if (!string.IsNullOrWhiteSpace(dto.Status) && Enum.TryParse<FollowupStatus>(dto.Status, true, out var parsedSt))
        {
            followup.Status = parsedSt;
            if (parsedSt == FollowupStatus.Completed && !followup.CompletedAt.HasValue)
            {
                followup.CompletedAt = DateTime.UtcNow;
            }
            else if (parsedSt is FollowupStatus.Pending or FollowupStatus.Rescheduled)
            {
                followup.CompletedAt = null;
            }
        }
        if (dto.Notes != null) followup.Notes = dto.Notes.Trim();
        if (!string.IsNullOrWhiteSpace(dto.FollowupType)) followup.FollowupType = dto.FollowupType.Trim().ToLower();
        var hasContactUpdate = dto.LeadId.HasValue || dto.CustomerId.HasValue || dto.InvestorId.HasValue;
        if (hasContactUpdate)
        {
            if (dto.LeadId is <= 0 || dto.CustomerId is <= 0 || dto.InvestorId is <= 0)
                return ApiResponse<FollowupResponseDto>.FailureResult("Contact IDs must be positive.");

            var selectedCount = (dto.LeadId.HasValue ? 1 : 0) + (dto.CustomerId.HasValue ? 1 : 0) + (dto.InvestorId.HasValue ? 1 : 0);
            if (selectedCount == 2 && dto.LeadId.HasValue && dto.CustomerId.HasValue &&
                followup.LeadId == dto.LeadId && followup.CustomerId == dto.CustomerId)
            {
                var linkedLead = await _context.Leads.FirstOrDefaultAsync(l => l.Id == dto.LeadId.Value && l.CompanyId == followup.CompanyId, ct);
                var customer = await _context.Customers.FirstOrDefaultAsync(c => c.Id == dto.CustomerId.Value && c.CompanyId == followup.CompanyId, ct);
                if (linkedLead == null || linkedLead.Status != "Converted" || customer == null || customer.Phone != linkedLead.Phone)
                    return ApiResponse<FollowupResponseDto>.FailureResult("A follow-up may retain both links only for its converted lead and matching customer.");
                followup.ContactType = "customer";
                followup.ContactId = customer.Id.ToString();
                followup.ContactName = customer.Name;
                followup.ContactPhone = customer.Phone;
            }
            else
            {
                if (selectedCount != 1)
                    return ApiResponse<FollowupResponseDto>.FailureResult("Choose exactly one lead, customer, or investor.");

                followup.LeadId = null;
                followup.CustomerId = null;
                followup.InvestorId = null;
                if (dto.LeadId.HasValue)
                {
                    var linkedLead = await _context.Leads.FirstOrDefaultAsync(l => l.Id == dto.LeadId.Value && l.CompanyId == followup.CompanyId, ct);
                    if (linkedLead == null) return ApiResponse<FollowupResponseDto>.FailureResult("Select a lead from this company.");
                    followup.LeadId = linkedLead.Id;
                    followup.ContactType = "lead";
                    followup.ContactId = linkedLead.Id.ToString();
                    followup.ContactName = linkedLead.Name;
                    followup.ContactPhone = linkedLead.Phone;
                }
                else if (dto.CustomerId.HasValue)
                {
                    var customer = await _context.Customers.FirstOrDefaultAsync(c => c.Id == dto.CustomerId.Value && c.CompanyId == followup.CompanyId, ct);
                    if (customer == null) return ApiResponse<FollowupResponseDto>.FailureResult("Select a customer from this company.");
                    followup.CustomerId = customer.Id;
                    followup.ContactType = "customer";
                    followup.ContactId = customer.Id.ToString();
                    followup.ContactName = customer.Name;
                    followup.ContactPhone = customer.Phone;
                }
                else
                {
                    var investor = await _context.Investors.FirstOrDefaultAsync(i => i.Id == dto.InvestorId!.Value && i.CompanyId == followup.CompanyId, ct);
                    if (investor == null) return ApiResponse<FollowupResponseDto>.FailureResult("Select an investor from this company.");
                    followup.InvestorId = investor.Id;
                    followup.ContactType = "investor";
                    followup.ContactId = investor.Id.ToString();
                    followup.ContactName = investor.Name;
                    followup.ContactPhone = investor.Phone;
                }
            }
        }

        if (dto.AssignedAgentId.HasValue && dto.AssignedAgentId.Value > 0)
        {
            if (string.Equals(_currentUser.Role, "sales_executive", StringComparison.OrdinalIgnoreCase) &&
                dto.AssignedAgentId.Value != _currentUser.UserId)
                return ApiResponse<FollowupResponseDto>.FailureResult("Sales executives cannot reassign follow-ups.");

            var agent = await _context.Users.Include(u => u.Role)
                .FirstOrDefaultAsync(u => u.Id == dto.AssignedAgentId.Value && u.CompanyId == followup.CompanyId, ct);
            if (agent == null)
                return ApiResponse<FollowupResponseDto>.FailureResult("The assigned user does not belong to this company.");
            followup.AssignedAgentId = agent.Id;
            followup.AssignedToName = agent.Name;
            followup.AssignedToRole = agent.Role?.Code ?? followup.AssignedToRole;
        }

        followup.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(ct);
        await RefreshLeadNextFollowupDateAsync(followup, ct);

        Lead? lead = null;
        if (!string.IsNullOrWhiteSpace(followup.ContactId) && int.TryParse(followup.ContactId, out var ucid))
        {
            lead = await _context.Leads.AsNoTracking().Include(l => l.AssignedBy).Include(l => l.AssignedAgent).FirstOrDefaultAsync(l => l.Id == ucid, ct);
        }
        else if (!string.IsNullOrWhiteSpace(followup.ContactPhone))
        {
            var p10 = followup.ContactPhone.Length >= 10 ? followup.ContactPhone[^10..] : followup.ContactPhone;
            lead = await _context.Leads.AsNoTracking().Include(l => l.AssignedBy).Include(l => l.AssignedAgent).FirstOrDefaultAsync(l => l.CompanyId == followup.CompanyId && l.Phone.Contains(p10), ct);
        }

        return ApiResponse<FollowupResponseDto>.SuccessResult(MapToDto(followup, lead), "Follow-up updated successfully.");
    }

    public async Task<ApiResponse<FollowupResponseDto>> CompleteFollowupAsync(int id, CancellationToken ct = default)
    {
        var followup = await FindScopedFollowupAsync(id, ct);
        if (followup == null)
            return ApiResponse<FollowupResponseDto>.FailureResult("Follow-up not found or access denied.");

        if (IsIrmFollowup(followup) && IsGhlAdmin())
        {
            return ApiResponse<FollowupResponseDto>.FailureResult("Access denied: GHL Admin has read-only access to IRM follow-up data.");
        }

        followup.Status = FollowupStatus.Completed;
        followup.CompletedAt = DateTime.UtcNow;
        followup.UpdatedAt = DateTime.UtcNow;

        _context.AuditLogs.Add(new AuditLog
        {
            CompanyId = followup.CompanyId,
            Timestamp = DateTime.UtcNow,
            ActorName = !string.IsNullOrWhiteSpace(_currentUser.Name) ? _currentUser.Name : (_currentUser.Email ?? "Agent"),
            ActorEmail = _currentUser.Email ?? string.Empty,
            Action = "FOLLOWUP_COMPLETED",
            EntityType = followup.CustomerId.HasValue ? "Customer" : (followup.LeadId.HasValue ? "Lead" : "Followup"),
            EntityId = followup.CustomerId.HasValue ? followup.CustomerId.Value.ToString() : (followup.LeadId.HasValue ? followup.LeadId.Value.ToString() : followup.Id.ToString()),
            LeadId = followup.LeadId,
            CustomerId = followup.CustomerId,
            Details = $"Completed follow-up for {followup.ContactName}{(string.IsNullOrWhiteSpace(followup.Notes) ? "" : $" • Notes: {followup.Notes}")}",
            Module = "Followups",
            Status = FollowupStatus.Completed.ToString()
        });

        // If the related lead is in "Follow-up Required" status and no other pending followups remain,
        // restore it to "Interested" so it flows back into the IRM's My Leads module.
        Lead? followupLead = null;
        if (!string.IsNullOrWhiteSpace(followup.ContactId) && int.TryParse(followup.ContactId, out var completeCid))
        {
            followupLead = await _context.Leads
                .Include(l => l.AssignedBy).Include(l => l.AssignedAgent)
                .FirstOrDefaultAsync(l => l.Id == completeCid && l.CompanyId == followup.CompanyId, ct);
        }
        else if (!string.IsNullOrWhiteSpace(followup.ContactPhone))
        {
            var p10c = followup.ContactPhone.Length >= 10 ? followup.ContactPhone[^10..] : followup.ContactPhone;
            followupLead = await _context.Leads
                .Include(l => l.AssignedBy).Include(l => l.AssignedAgent)
                .FirstOrDefaultAsync(l => l.CompanyId == followup.CompanyId && l.Phone.Contains(p10c), ct);
        }

        if (followupLead != null && followupLead.Status == "Follow-up Required")
        {
            // Check if any OTHER pending followups still exist for this lead
            var cleanContactId = followup.ContactId?.Trim() ?? string.Empty;
            var cleanPhone10 = followup.ContactPhone?.Length >= 10 ? followup.ContactPhone[^10..] : followup.ContactPhone ?? string.Empty;
            var otherPendingCount = await _context.Followups
                .CountAsync(f =>
                    f.Id != followup.Id &&
                    f.CompanyId == followup.CompanyId &&
                    f.Status == FollowupStatus.Pending &&
                    ((cleanContactId != "" && f.ContactId == cleanContactId) ||
                     (cleanPhone10 != "" && f.ContactPhone != null && f.ContactPhone.Contains(cleanPhone10))),
                ct);

            if (otherPendingCount == 0)
            {
                var kycAndAboveStages = new[] { "qualified_investor", "qualified", "investment_opportunity", "opportunity", "term_sheet", "committed", "converted", "won" };
                var hasKycDeal = await _context.GhlDeals.AnyAsync(d =>
                    d.CompanyId == followup.CompanyId &&
                    kycAndAboveStages.Contains(d.Stage) &&
                    ((d.CustomerId != null && d.CustomerId == followupLead.Id) ||
                     (d.CustomerName != null && d.CustomerName == followupLead.Name) ||
                     (cleanPhone10 != "" && d.Customer != null && d.Customer.Phone != null && d.Customer.Phone.Contains(cleanPhone10))),
                    ct);

                if (!hasKycDeal)
                {
                    followupLead.Status = "Interested";
                    followupLead.UpdatedAt = DateTime.UtcNow;
                }
            }
        }

        await _context.SaveChangesAsync(ct);
        await RefreshLeadNextFollowupDateAsync(followup, ct);

        Lead? lead = followupLead;
        if (lead == null)
        {
            if (!string.IsNullOrWhiteSpace(followup.ContactId) && int.TryParse(followup.ContactId, out var ccid))
            {
                lead = await _context.Leads.AsNoTracking().Include(l => l.AssignedBy).Include(l => l.AssignedAgent).FirstOrDefaultAsync(l => l.Id == ccid, ct);
            }
            else if (!string.IsNullOrWhiteSpace(followup.ContactPhone))
            {
                var p10 = followup.ContactPhone.Length >= 10 ? followup.ContactPhone[^10..] : followup.ContactPhone;
                lead = await _context.Leads.AsNoTracking().Include(l => l.AssignedBy).Include(l => l.AssignedAgent).FirstOrDefaultAsync(l => l.CompanyId == followup.CompanyId && l.Phone.Contains(p10), ct);
            }
        }

        return ApiResponse<FollowupResponseDto>.SuccessResult(MapToDto(followup, lead), "Follow-up completed successfully.");
    }

    public async Task<ApiResponse<bool>> DeleteFollowupAsync(int id, CancellationToken ct = default)
    {
        var followup = await FindScopedFollowupAsync(id, ct);
        if (followup == null)
            return ApiResponse<bool>.FailureResult("Follow-up not found or access denied.");

        if (IsIrmFollowup(followup) && IsGhlAdmin())
        {
            return ApiResponse<bool>.FailureResult("Access denied: GHL Admin has read-only access to IRM follow-up data.");
        }

        _context.Followups.Remove(followup);
        await _context.SaveChangesAsync(ct);
        await RefreshLeadNextFollowupDateAsync(followup, ct);

        return ApiResponse<bool>.SuccessResult(true, "Follow-up deleted successfully.");
    }

    private static FollowupResponseDto MapToDto(Followup f, Lead? lead = null)
    {
        int? assignedById = null;
        string? assignedByName = null;

        if (lead != null)
        {
            if (lead.AssignedBy != null && lead.AssignedById != lead.AssignedAgentId)
            {
                assignedById = lead.AssignedById;
                assignedByName = lead.AssignedBy.Name;
            }
            else if (lead.CustomFieldsJson != null && (lead.CustomFieldsJson.Contains("qualifiedByAgentName") || lead.CustomFieldsJson.Contains("assignedByAgentName")))
            {
                try
                {
                    var customFields = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, string>>(lead.CustomFieldsJson);
                    if (customFields != null)
                    {
                        assignedByName = customFields.GetValueOrDefault("qualifiedByAgentName") ?? customFields.GetValueOrDefault("assignedByAgentName");
                    }
                }
                catch { }
            }

            if (string.IsNullOrWhiteSpace(assignedByName))
            {
                if (lead.AssignedById == lead.AssignedAgentId || lead.AssignedBy == null)
                {
                    assignedById = lead.AssignedAgentId;
                    assignedByName = lead.AssignedAgent?.Name ?? "Created by IRM";
                }
            }
        }

        return new FollowupResponseDto
        {
            Id = f.Id,
            CompanyId = f.CompanyId,
            AssignedAgentId = f.AssignedAgentId,
            AssignedAgentName = f.AssignedAgent?.Name ?? f.AssignedToName,
            AssignedRole = f.AssignedAgent?.Role?.Code ?? (!string.IsNullOrWhiteSpace(f.AssignedToRole) ? f.AssignedToRole : "sales_executive"),
            AssignedAgentRole = f.AssignedAgent?.Role?.Name ?? f.AssignedToRole,
            AssignedById = assignedById,
            AssignedByName = assignedByName,
            ContactId = f.ContactId,
            ContactType = f.ContactType,
            LeadId = f.LeadId,
            CustomerId = f.CustomerId,
            InvestorId = f.InvestorId,
            ContactName = f.ContactName,
            ContactPhone = f.ContactPhone,
            ContactEmail = f.ContactEmail,
            ScheduledAt = f.ScheduledAt,
            Priority = f.Priority,
            Status = f.Status.ToString(),
            Notes = f.Notes,
            FollowupType = f.FollowupType ?? "call",
            CompletedAt = f.CompletedAt,
            CreatedAt = f.CreatedAt,
            UpdatedAt = f.UpdatedAt,
            HandoverId = f.HandoverId,
            HandedOverFromName = f.OriginalOwner?.Name,
            HandoverPlannedEnd = f.Handover?.PlannedEndAt,
            OriginalOwnerId = f.OriginalOwnerId
        };
    }

    private async Task RefreshLeadNextFollowupDateAsync(Followup followup, CancellationToken ct)
    {
        if (!string.Equals(followup.ContactType, "lead", StringComparison.OrdinalIgnoreCase))
            return;

        int? targetLeadId = followup.LeadId;
        if (!targetLeadId.HasValue && int.TryParse(followup.ContactId, out var parsedId))
        {
            targetLeadId = parsedId;
        }

        if (!targetLeadId.HasValue) return;

        var lead = await _context.Leads.FirstOrDefaultAsync(
            l => l.Id == targetLeadId.Value && l.CompanyId == followup.CompanyId, ct);
        if (lead == null) return;

        // Count active (pending/rescheduled) followups remaining for this lead
        lead.NextFollowupDate = await _context.Followups
            .Where(f => f.CompanyId == followup.CompanyId && f.ContactType == "lead" &&
                        (f.LeadId == targetLeadId.Value || f.ContactId == targetLeadId.Value.ToString()) &&
                        (f.Status == FollowupStatus.Pending || f.Status == FollowupStatus.Rescheduled))
            .OrderBy(f => f.ScheduledAt)
            .Select(f => (DateTime?)f.ScheduledAt)
            .FirstOrDefaultAsync(ct);

        if (!lead.NextFollowupDate.HasValue && lead.Status == "Follow-up Required")
        {
            // No more active followups — check whether at least one was Completed or all were Cancelled
            var hasAnyCompleted = await _context.Followups
                .AnyAsync(f => f.CompanyId == followup.CompanyId && f.ContactType == "lead" &&
                               (f.LeadId == targetLeadId.Value || f.ContactId == targetLeadId.Value.ToString()) &&
                               f.Status == FollowupStatus.Completed, ct);

            // If at least one followup was properly completed → mark as Follow-up Completed
            // If all remaining were cancelled (none completed) → revert to Contacted (neutral)
            lead.Status = hasAnyCompleted ? "Follow-up Completed" : "Contacted";
        }
        else if (lead.NextFollowupDate.HasValue && (lead.Status == "New" || lead.Status == "Follow-up Completed" || lead.Status == "Contacted"))
        {
            lead.Status = "Follow-up Required";
        }

        lead.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);
    }
}
