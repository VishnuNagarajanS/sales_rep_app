using backend.Authentication.Interfaces;
using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.Followups;
using backend.Models.Entities;
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

        if (role == "sales_executive" && agentId.HasValue)
        {
            query = query.Where(f => f.AssignedAgentId == agentId.Value);
        }

        return query;
    }

    private async Task<Followup?> FindScopedFollowupAsync(int id, CancellationToken ct)
    {
        var role = _currentUser.Role;
        var agentId = _currentUser.UserId;
        var companyId = _currentUser.CompanyId;

        var query = _context.Followups.Include(f => f.AssignedAgent).Where(f => f.Id == id);

        if (role == "super_admin")
        {
            return await query.FirstOrDefaultAsync(ct);
        }

        if (companyId.HasValue)
        {
            query = query.Where(f => f.CompanyId == companyId.Value);
        }

        if (role == "sales_executive" && agentId.HasValue)
        {
            query = query.Where(f => f.AssignedAgentId == agentId.Value);
        }

        return await query.FirstOrDefaultAsync(ct);
    }

    public async Task<ApiResponse<PagedResult<FollowupResponseDto>>> GetFollowupsAsync(FollowupFilterDto filter, CancellationToken ct = default)
    {
        var query = GetScopedFollowupsQuery();

        // Status filter
        if (!string.IsNullOrWhiteSpace(filter.Status) && !filter.Status.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(f => f.Status == filter.Status);
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
                query = query.Where(f => f.ScheduledAt >= todayStart && f.ScheduledAt < tomorrowStart && f.Status == "Pending");
            }
            else if (scope == "overdue")
            {
                query = query.Where(f => f.ScheduledAt < now && f.Status == "Pending");
            }
        }

        var totalCount = await query.CountAsync(ct);

        var page = Math.Max(1, filter.Page);
        var pageSize = Math.Clamp(filter.PageSize, 1, 100);

        var entities = await query
            .OrderBy(f => f.Status == "Pending" ? 0 : 1)
            .ThenBy(f => f.ScheduledAt)
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
        var agentId = _currentUser.UserId ?? 1;
        var companyId = _currentUser.CompanyId ?? 1;

        var followup = new Followup
        {
            CompanyId = companyId,
            AssignedAgentId = agentId,
            ContactId = dto.ContactId.Trim(),
            ContactType = string.IsNullOrWhiteSpace(dto.ContactType) ? "lead" : dto.ContactType.Trim().ToLower(),
            ContactName = dto.ContactName.Trim(),
            ContactPhone = dto.ContactPhone.Trim(),
            ScheduledAt = dto.ScheduledAt,
            Priority = string.IsNullOrWhiteSpace(dto.Priority) ? "Medium" : dto.Priority.Trim(),
            Status = "Pending",
            Notes = dto.Notes?.Trim() ?? string.Empty,
            CreatedAt = DateTime.UtcNow
        };

        _context.Followups.Add(followup);

        // If this is for a Lead, update Lead's NextFollowupDate
        if (followup.ContactType == "lead" && int.TryParse(followup.ContactId, out var leadId))
        {
            var lead = await _context.Leads.FirstOrDefaultAsync(l => l.Id == leadId && l.CompanyId == companyId, ct);
            if (lead != null)
            {
                lead.NextFollowupDate = followup.ScheduledAt;
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

        if (dto.ScheduledAt.HasValue) followup.ScheduledAt = dto.ScheduledAt.Value;
        if (!string.IsNullOrWhiteSpace(dto.Priority)) followup.Priority = dto.Priority.Trim();
        if (!string.IsNullOrWhiteSpace(dto.Status)) followup.Status = dto.Status.Trim();
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

        followup.Status = "Completed";
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
            ContactId = f.ContactId,
            ContactType = f.ContactType,
            ContactName = f.ContactName,
            ContactPhone = f.ContactPhone,
            ScheduledAt = f.ScheduledAt,
            Priority = f.Priority,
            Status = f.Status,
            Notes = f.Notes,
            CompletedAt = f.CompletedAt,
            CreatedAt = f.CreatedAt,
            UpdatedAt = f.UpdatedAt
        };
    }
}
