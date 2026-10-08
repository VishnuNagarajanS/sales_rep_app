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

        var query = _context.Followups.AsNoTracking().Include(f => f.AssignedAgent).AsQueryable();

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
                     (f.ContactPhone != null && f.ContactPhone != "" && f.ContactPhone == l.Phone)))
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
                     (f.ContactPhone != null && f.ContactPhone != "" && f.ContactPhone == l.Phone)))
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

        var totalCount = entities.Count;
        var page = Math.Max(1, filter.Page);
        var pageSize = Math.Clamp(filter.PageSize, 1, 100);

        var paged = entities
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        var items = paged.Select(MapToDto).ToList();

        return ApiResponse<PagedResult<FollowupResponseDto>>.SuccessResult(
            PagedResult<FollowupResponseDto>.Create(items, totalCount, page, pageSize),
            "Follow-ups retrieved successfully.");
    }

    public async Task<ApiResponse<FollowupResponseDto>> GetFollowupByIdAsync(int id, CancellationToken ct = default)
    {
        var followup = await FindScopedFollowupAsync(id, ct);
        if (followup == null)
            return ApiResponse<FollowupResponseDto>.FailureResult("Follow-up not found or access denied.");

        return ApiResponse<FollowupResponseDto>.SuccessResult(MapToDto(followup));
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
                targetLead = await _context.Leads.Include(l => l.AssignedAgent).ThenInclude(a => a.Role)
                    .FirstOrDefaultAsync(l => l.Id == parsedLeadId && l.CompanyId == companyId.Value, ct);
            }
            if (targetLead == null && !string.IsNullOrWhiteSpace(dto.ContactPhone))
            {
                var p10 = dto.ContactPhone.Length >= 10 ? dto.ContactPhone[^10..] : dto.ContactPhone;
                targetLead = await _context.Leads.Include(l => l.AssignedAgent).ThenInclude(a => a.Role)
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
                if (targetLead.Status == "New" || targetLead.Status == "Contacted" || targetLead.Status == "Callback")
                {
                    targetLead.Status = "Follow-up Required";
                }
            }

            await _context.SaveChangesAsync(ct);
            await _context.Entry(existingPending).Reference(f => f.AssignedAgent).LoadAsync(ct);
            return ApiResponse<FollowupResponseDto>.SuccessResult(MapToDto(existingPending), "Existing pending follow-up updated.");
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
            ContactEmail = resolvedEmail,
            ScheduledAt = dto.ScheduledAt,
            Priority = string.IsNullOrWhiteSpace(dto.Priority) ? "Medium" : dto.Priority.Trim(),
            Status = FollowupStatus.Pending,
            Notes = dto.Notes?.Trim() ?? string.Empty,
            CreatedAt = DateTime.UtcNow
        };

        // Supersede any existing open pending follow-ups for this contact so only one active pending reminder exists per contact
        var cleanPhone10 = dto.ContactPhone?.Length >= 10 ? dto.ContactPhone[^10..] : dto.ContactPhone ?? string.Empty;
        var existingOldPending = await _context.Followups
            .Where(f =>
                f.CompanyId == companyId.Value &&
                f.Status == FollowupStatus.Pending &&
                ((f.ContactId != null && f.ContactId != "" && f.ContactId == cleanContactId) ||
                 (cleanPhone10 != "" && f.ContactPhone != null && f.ContactPhone.Contains(cleanPhone10))))
            .ToListAsync(ct);

        foreach (var oldF in existingOldPending)
        {
            oldF.Status = FollowupStatus.Completed;
            oldF.CompletedAt = DateTime.UtcNow;
            if (!string.IsNullOrWhiteSpace(oldF.Notes) && !oldF.Notes.Contains("Superseded"))
            {
                oldF.Notes += $" | Superseded by follow-up scheduled for {dto.ScheduledAt:yyyy-MM-dd HH:mm}";
            }
        }

        _context.Followups.Add(followup);

        if (targetLead != null)
        {
            targetLead.NextFollowupDate = followup.ScheduledAt;
            if (targetLead.Status == "New" || targetLead.Status == "Contacted" || targetLead.Status == "Callback")
            {
                targetLead.Status = "Follow-up Required";
            }
        }

        await _context.SaveChangesAsync(ct);

        await _context.Entry(followup).Reference(f => f.AssignedAgent).LoadAsync(ct);

        return ApiResponse<FollowupResponseDto>.SuccessResult(MapToDto(followup), "Follow-up scheduled successfully.");
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

        return ApiResponse<FollowupResponseDto>.SuccessResult(MapToDto(followup), "Follow-up updated successfully.");
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

        await _context.SaveChangesAsync(ct);

        return ApiResponse<FollowupResponseDto>.SuccessResult(MapToDto(followup), "Follow-up completed successfully.");
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

    private static FollowupResponseDto MapToDto(Followup f)
    {
        return new FollowupResponseDto
        {
            Id = f.Id,
            CompanyId = f.CompanyId,
            AssignedAgentId = f.AssignedAgentId,
            AssignedAgentName = f.AssignedAgent?.Name,
            AssignedAgentRole = f.AssignedAgent?.Role?.Name ?? f.AssignedToRole,
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
            UpdatedAt = f.UpdatedAt
        };
    }
}
