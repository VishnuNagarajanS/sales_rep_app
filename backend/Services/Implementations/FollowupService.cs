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

    public FollowupService(ApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
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
            query = agentId.HasValue
                ? query.Where(f => f.AssignedAgentId == agentId.Value)
                : query.Where(_ => false);

        return query;
    }

    private async Task<Followup?> FindScopedFollowupAsync(int id, CancellationToken ct)
    {
        var role = _currentUser.Role;
        var agentId = _currentUser.UserId;
        var companyId = _currentUser.CompanyId;

        var query = _context.Followups
            .Include(f => f.AssignedAgent)
                .ThenInclude(a => a!.Role)
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
            query = query.Where(f => f.AssignedAgentId == agentId.Value);
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

        var totalCount = await query.CountAsync(ct);

        var page = Math.Max(1, filter.Page);
        var pageSize = Math.Clamp(filter.PageSize, 1, 500);

        var entities = await query
            .OrderBy(f => f.Status == FollowupStatus.Completed ? 1 : 0)
            .ThenByDescending(f => f.ScheduledAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var items = entities.Select(MapToDto).ToList();

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

        var isSalesExecutive = string.Equals(role, "sales_executive", StringComparison.OrdinalIgnoreCase);
        var targetAgentId = isSalesExecutive ? _currentUser.UserId : dto.AssignedAgentId ?? _currentUser.UserId;
        User? assignedAgent = null;
        if (targetAgentId.HasValue)
        {
            assignedAgent = await _context.Users.Include(u => u.Role).FirstOrDefaultAsync(
                u => u.Id == targetAgentId.Value && u.CompanyId == companyId, ct);
            if (assignedAgent == null)
                return ApiResponse<FollowupResponseDto>.FailureResult("The assigned user does not belong to this company.");
        }

        var followup = new Followup
        {
            CompanyId = companyId,
            AssignedAgentId = assignedAgent?.Id ?? targetAgentId,
            AssignedAgent = assignedAgent,
            AssignedToName = assignedAgent?.Name ?? "Unassigned",
            AssignedToRole = assignedAgent?.Role?.Name ?? "Sales Executive",
            ContactId = contactId,
            ContactType = contactType,
            LeadId = leadId,
            CustomerId = customerId,
            InvestorId = investorId,
            ContactName = dto.ContactName?.Trim() ?? string.Empty,
            ContactPhone = dto.ContactPhone?.Trim() ?? string.Empty,
            ScheduledAt = dto.ScheduledAt,
            Priority = string.IsNullOrWhiteSpace(dto.Priority) ? "Medium" : dto.Priority.Trim(),
            Status = FollowupStatus.Pending,
            Notes = dto.Notes?.Trim() ?? string.Empty,
            FollowupType = string.IsNullOrWhiteSpace(dto.FollowupType) ? "call" : dto.FollowupType.Trim().ToLower(),
            CreatedAt = DateTime.UtcNow
        };

        _context.Followups.Add(followup);

        await _context.SaveChangesAsync(ct);
        await RefreshLeadNextFollowupDateAsync(followup, ct);

        if (followup.AssignedAgent == null && followup.AssignedAgentId.HasValue)
        {
            await _context.Entry(followup).Reference(f => f.AssignedAgent).Query().Include(a => a.Role).LoadAsync(ct);
        }

        return ApiResponse<FollowupResponseDto>.SuccessResult(MapToDto(followup), "Follow-up scheduled successfully.");
    }

    public async Task<ApiResponse<FollowupResponseDto>> UpdateFollowupAsync(int id, UpdateFollowupDto dto, CancellationToken ct = default)
    {
        var followup = await FindScopedFollowupAsync(id, ct);
        if (followup == null)
            return ApiResponse<FollowupResponseDto>.FailureResult("Follow-up not found or access denied.");

        if (dto.ScheduledAt.HasValue) followup.ScheduledAt = dto.ScheduledAt.Value;
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
                var lead = await _context.Leads.FirstOrDefaultAsync(l => l.Id == dto.LeadId.Value && l.CompanyId == followup.CompanyId, ct);
                var customer = await _context.Customers.FirstOrDefaultAsync(c => c.Id == dto.CustomerId.Value && c.CompanyId == followup.CompanyId, ct);
                if (lead == null || lead.Status != "Converted" || customer == null || customer.Phone != lead.Phone)
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
                    var lead = await _context.Leads.FirstOrDefaultAsync(l => l.Id == dto.LeadId.Value && l.CompanyId == followup.CompanyId, ct);
                    if (lead == null) return ApiResponse<FollowupResponseDto>.FailureResult("Select a lead from this company.");
                    followup.LeadId = lead.Id;
                    followup.ContactType = "lead";
                    followup.ContactId = lead.Id.ToString();
                    followup.ContactName = lead.Name;
                    followup.ContactPhone = lead.Phone;
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

        return ApiResponse<FollowupResponseDto>.SuccessResult(MapToDto(followup), "Follow-up updated successfully.");
    }

    public async Task<ApiResponse<FollowupResponseDto>> CompleteFollowupAsync(int id, CancellationToken ct = default)
    {
        var followup = await FindScopedFollowupAsync(id, ct);
        if (followup == null)
            return ApiResponse<FollowupResponseDto>.FailureResult("Follow-up not found or access denied.");

        followup.Status = FollowupStatus.Completed;
        followup.CompletedAt = DateTime.UtcNow;
        followup.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(ct);
        await RefreshLeadNextFollowupDateAsync(followup, ct);

        return ApiResponse<FollowupResponseDto>.SuccessResult(MapToDto(followup), "Follow-up completed successfully.");
    }

    public async Task<ApiResponse<bool>> DeleteFollowupAsync(int id, CancellationToken ct = default)
    {
        var followup = await FindScopedFollowupAsync(id, ct);
        if (followup == null)
            return ApiResponse<bool>.FailureResult("Follow-up not found or access denied.");

        _context.Followups.Remove(followup);
        await _context.SaveChangesAsync(ct);
        await RefreshLeadNextFollowupDateAsync(followup, ct);

        return ApiResponse<bool>.SuccessResult(true, "Follow-up deleted successfully.");
    }

    private static FollowupResponseDto MapToDto(Followup f)
    {
        return new FollowupResponseDto
        {
            Id = f.Id,
            CompanyId = f.CompanyId,
            AssignedAgentId = f.AssignedAgentId,
            AssignedAgentName = f.AssignedAgent?.Name ?? f.AssignedToName,
            AssignedRole = f.AssignedAgent?.Role?.Code ?? (!string.IsNullOrWhiteSpace(f.AssignedToRole) ? f.AssignedToRole : "sales_executive"),
            ContactId = f.ContactId,
            ContactType = f.ContactType,
            LeadId = f.LeadId,
            CustomerId = f.CustomerId,
            InvestorId = f.InvestorId,
            ContactName = f.ContactName,
            ContactPhone = f.ContactPhone,
            ScheduledAt = f.ScheduledAt,
            Priority = f.Priority,
            Status = f.Status.ToString(),
            Notes = f.Notes,
            FollowupType = f.FollowupType ?? "call",
            CompletedAt = f.CompletedAt,
            CreatedAt = f.CreatedAt,
            UpdatedAt = f.UpdatedAt
        };
    }

    private async Task RefreshLeadNextFollowupDateAsync(Followup followup, CancellationToken ct)
    {
        if (!string.Equals(followup.ContactType, "lead", StringComparison.OrdinalIgnoreCase) ||
            !followup.LeadId.HasValue)
            return;

        var lead = await _context.Leads.FirstOrDefaultAsync(
            l => l.Id == followup.LeadId.Value && l.CompanyId == followup.CompanyId, ct);
        if (lead == null) return;

        lead.NextFollowupDate = await _context.Followups
            .Where(f => f.CompanyId == followup.CompanyId && f.ContactType == "lead" &&
                        f.LeadId == followup.LeadId &&
                        (f.Status == FollowupStatus.Pending || f.Status == FollowupStatus.Rescheduled))
            .OrderBy(f => f.ScheduledAt)
            .Select(f => (DateTime?)f.ScheduledAt)
            .FirstOrDefaultAsync(ct);
        lead.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);
    }
}
