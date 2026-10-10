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

    private IQueryable<Followup> GetScopedFollowupsQuery()
    {
        var role = _currentUser.Role;
        var agentId = _currentUser.UserId;
        var companyId = _currentUser.CompanyId;

        var query = _context.Followups.AsNoTracking()
            .Include(f => f.AssignedAgent)
            .Include(f => f.OriginalOwner)
            .Include(f => f.Handover)
            .AsQueryable();

        if (role == "super_admin")
        {
            if (companyId.HasValue)
                query = query.Where(f => f.CompanyId == companyId.Value);
            return query;
        }

        if (companyId.HasValue)
        {
            query = query.Where(f => f.CompanyId == companyId.Value);
        }

        if ((role == "sales_executive" || role == "irm") && agentId.HasValue)
        {
            var cid = companyId ?? 1;
            query = query.Where(f =>
                f.AssignedAgentId == agentId.Value ||
                _context.Leads.Any(l => l.CompanyId == cid && l.AssignedAgentId == agentId.Value &&
                    ((f.ContactId != null && f.ContactId != "" && f.ContactId == l.Id.ToString()) ||
                     (f.ContactPhone != null && f.ContactPhone != "" && (f.ContactPhone == l.Phone || f.ContactPhone.Contains(l.Phone) || l.Phone.Contains(f.ContactPhone)))))
            );
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
            .ThenInclude(a => a.Role)
            .Include(f => f.OriginalOwner)
            .Include(f => f.Handover)
            .Where(f => f.Id == id);

        if (role == "super_admin")
        {
            return await query.FirstOrDefaultAsync(ct);
        }

        if (companyId.HasValue)
        {
            query = query.Where(f => f.CompanyId == companyId.Value);
        }

        if ((role == "sales_executive" || role == "irm") && agentId.HasValue)
        {
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
        var query = GetScopedFollowupsQuery();

        // Status filter
        if (!string.IsNullOrWhiteSpace(filter.Status) && !filter.Status.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            if (Enum.TryParse<FollowupStatus>(filter.Status, true, out var stFilter))
            {
                query = query.Where(f => f.Status == stFilter);
            }
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
                query = query.Where(f => f.ScheduledAt >= todayStart && f.ScheduledAt < tomorrowStart && f.Status == FollowupStatus.Pending);
            }
            else if (scope == "overdue")
            {
                query = query.Where(f => f.ScheduledAt < now && f.Status == FollowupStatus.Pending);
            }
        }

        var companyId = _currentUser.CompanyId ?? 1;
        var otherMatcher = await _otherService.GetOtherMatcherAsync(companyId, "follow_up", ct);

        var entities = await query
            .OrderBy(f => f.Status == FollowupStatus.Pending ? 0 : 1)
            .ThenBy(f => f.ScheduledAt)
            .ToListAsync(ct);

        if (otherMatcher.HasAnyOther)
        {
            entities = entities
                .Where(f => !otherMatcher.IsInOther(f.ContactPhone, f.InvestorId, f.LeadId, f.ContactName))
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
            return MapToDto(f, lead);
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

        var agentId = _currentUser.UserId;
        if (!agentId.HasValue || agentId.Value <= 0)
            return ApiResponse<FollowupResponseDto>.FailureResult("Unauthorized: User ID is missing.");

        var companyId = _currentUser.CompanyId;
        if (!companyId.HasValue || companyId.Value <= 0)
            return ApiResponse<FollowupResponseDto>.FailureResult("Unauthorized: Company ID is missing.");

        // Do not merge legitimate separate follow-up tasks merely because they belong to the same customer or have nearby schedules.
        // Only deduplicate exact rapid resubmissions (exact same contact ID, exact same scheduled time, and identical notes created within 60 seconds)
        var cleanContactId = dto.ContactId.Trim();
        var cleanNotes = (dto.Notes ?? string.Empty).Trim();

        var existingPending = await _context.Followups
            .Include(f => f.AssignedAgent)
            .ThenInclude(a => a.Role)
            .Where(f =>
                f.CompanyId == companyId.Value &&
                f.Status == FollowupStatus.Pending &&
                f.ContactId == cleanContactId &&
                f.ScheduledAt == dto.ScheduledAt &&
                f.Notes == cleanNotes &&
                f.CreatedAt >= DateTime.UtcNow.AddSeconds(-60))
            .FirstOrDefaultAsync(ct);

        // Resolve target lead if this is a lead follow-up
        Lead? targetLead = null;
        if (string.Equals(dto.ContactType, "lead", StringComparison.OrdinalIgnoreCase))
        {
            if (int.TryParse(dto.ContactId, out var parsedLeadId))
            {
                targetLead = await _context.Leads.Include(l => l.AssignedAgent).ThenInclude(a => a.Role).Include(l => l.AssignedBy)
                    .FirstOrDefaultAsync(l => l.Id == parsedLeadId && l.CompanyId == companyId.Value, ct);
            }
            if (targetLead == null && !string.IsNullOrWhiteSpace(dto.ContactPhone))
            {
                var p10 = dto.ContactPhone.Length >= 10 ? dto.ContactPhone[^10..] : dto.ContactPhone;
                targetLead = await _context.Leads.Include(l => l.AssignedAgent).ThenInclude(a => a.Role).Include(l => l.AssignedBy)
                    .FirstOrDefaultAsync(l => l.CompanyId == companyId.Value && l.Phone.Contains(p10), ct);
            }
        }

        int targetAgentId = agentId.Value;
        if (dto.AssignedAgentId.HasValue && dto.AssignedAgentId.Value > 0)
        {
            targetAgentId = dto.AssignedAgentId.Value;
        }
        else if (targetLead?.AssignedAgentId != null && targetLead.AssignedAgentId.Value > 0)
        {
            targetAgentId = targetLead.AssignedAgentId.Value;
        }

        var assignedUser = await _context.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.Id == targetAgentId, ct);
        var targetRole = dto.AssignedToRole ?? assignedUser?.Role?.Code ?? "sales_executive";
        var targetName = assignedUser?.Name ?? string.Empty;

        if (existingPending != null)
        {
            if (IsIrmFollowup(existingPending) && IsGhlAdmin())
            {
                return ApiResponse<FollowupResponseDto>.FailureResult("Access denied: GHL Admin has read-only access to IRM follow-up data.");
            }

            // Reuse and update the existing active pending follow-up (idempotency)
            existingPending.ScheduledAt = dto.ScheduledAt;
            if (!string.IsNullOrWhiteSpace(dto.Priority)) existingPending.Priority = dto.Priority.Trim();
            if (!string.IsNullOrWhiteSpace(dto.Notes)) existingPending.Notes = dto.Notes.Trim();
            if (!string.IsNullOrWhiteSpace(dto.ContactEmail)) existingPending.ContactEmail = dto.ContactEmail.Trim();
            existingPending.AssignedAgentId = targetAgentId;
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
            else if (int.TryParse(dto.ContactId, out var parsedCustId))
            {
                var cust = await _context.Customers.FirstOrDefaultAsync(c => c.Id == parsedCustId && c.CompanyId == companyId.Value, ct);
                resolvedEmail = cust?.Email;
            }
        }

        var followup = new Followup
        {
            CompanyId = companyId.Value,
            AssignedAgentId = targetAgentId,
            AssignedToRole = targetRole,
            AssignedToName = targetName,
            ContactId = dto.ContactId.Trim(),
            ContactType = string.IsNullOrWhiteSpace(dto.ContactType) ? "lead" : dto.ContactType.Trim().ToLower(),
            ContactName = dto.ContactName.Trim(),
            ContactPhone = dto.ContactPhone.Trim(),
            ContactEmail = resolvedEmail ?? string.Empty,
            ScheduledAt = dto.ScheduledAt,
            Priority = string.IsNullOrWhiteSpace(dto.Priority) ? "Medium" : dto.Priority.Trim(),
            Status = FollowupStatus.Pending,
            Notes = dto.Notes?.Trim() ?? string.Empty,
            CreatedAt = DateTime.UtcNow
        };

        // Deduplicate: If an active pending follow-up already exists for this contact, update it in place instead of creating a duplicate row!
        var cleanPhone10 = dto.ContactPhone?.Length >= 10 ? dto.ContactPhone[^10..] : dto.ContactPhone ?? string.Empty;
        var existingOldPending = await _context.Followups
            .Where(f =>
                f.CompanyId == companyId.Value &&
                f.Status == FollowupStatus.Pending &&
                ((f.ContactId != null && f.ContactId != "" && f.ContactId != "contact-new" && f.ContactId == cleanContactId) ||
                 (cleanPhone10 != "" && f.ContactPhone != null && f.ContactPhone.Contains(cleanPhone10))))
            .ToListAsync(ct);

        if (existingOldPending.Count > 0)
        {
            var primaryFollowup = existingOldPending.First();
            primaryFollowup.ScheduledAt = dto.ScheduledAt;
            if (!string.IsNullOrWhiteSpace(dto.Priority)) primaryFollowup.Priority = dto.Priority.Trim();
            if (!string.IsNullOrWhiteSpace(dto.Notes)) primaryFollowup.Notes = dto.Notes.Trim();
            if (!string.IsNullOrWhiteSpace(resolvedEmail)) primaryFollowup.ContactEmail = resolvedEmail;
            primaryFollowup.AssignedAgentId = targetAgentId;
            primaryFollowup.AssignedToRole = targetRole;
            primaryFollowup.AssignedToName = targetName;
            primaryFollowup.UpdatedAt = DateTime.UtcNow;

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
            if (targetLead.Status == "New" || targetLead.Status == "Contacted" || targetLead.Status == "Callback" || targetLead.Status == "Interested")
            {
                targetLead.Status = "Follow-up Required";
                targetLead.UpdatedAt = DateTime.UtcNow;
            }
        }
        else if (int.TryParse(followup.ContactId, out var custId))
        {
            var cust = await _context.Customers.FirstOrDefaultAsync(c => c.Id == custId && c.CompanyId == companyId.Value, ct);
            if (cust != null)
            {
                inheritedHandoverId = cust.HandoverId;
                inheritedOriginalOwnerId = cust.OriginalOwnerId;
            }
        }

        followup.HandoverId = inheritedHandoverId;
        followup.OriginalOwnerId = inheritedOriginalOwnerId;

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

        if (dto.ScheduledAt.HasValue) followup.ScheduledAt = dto.ScheduledAt.Value;
        if (!string.IsNullOrWhiteSpace(dto.Priority)) followup.Priority = dto.Priority.Trim();
        if (!string.IsNullOrWhiteSpace(dto.Status) && Enum.TryParse<FollowupStatus>(dto.Status, true, out var parsedSt))
        {
            followup.Status = parsedSt;
        }
        if (dto.Notes != null) followup.Notes = dto.Notes.Trim();

        followup.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(ct);

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
            AssignedAgentName = f.AssignedAgent?.Name,
            AssignedAgentRole = f.AssignedAgent?.Role?.Name ?? f.AssignedToRole,
            AssignedById = assignedById,
            AssignedByName = assignedByName,
            ContactId = f.ContactId,
            ContactType = f.ContactType,
            ContactName = f.ContactName,
            ContactPhone = f.ContactPhone,
            ContactEmail = f.ContactEmail,
            ScheduledAt = f.ScheduledAt,
            Priority = f.Priority,
            Status = f.Status.ToString(),
            Notes = f.Notes,
            CompletedAt = f.CompletedAt,
            CreatedAt = f.CreatedAt,
            UpdatedAt = f.UpdatedAt,
            HandoverId = f.HandoverId,
            HandedOverFromName = f.OriginalOwner?.Name,
            HandoverPlannedEnd = f.Handover?.PlannedEndAt,
            OriginalOwnerId = f.OriginalOwnerId
        };
    }
}
