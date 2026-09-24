using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.Followups;
using backend.Models.Entities;
using backend.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Implementations;

public sealed class FollowupService(ApplicationDbContext context, ICurrentUserService currentUser) : IFollowupService
{
    public async Task<IReadOnlyList<FollowupDto>> GetAsync(CancellationToken cancellationToken) =>
        await context.Followups.AsNoTracking()
            .Where(x => x.CompanyId == currentUser.CompanyId && x.UserId == currentUser.UserId)
            .OrderBy(x => x.ScheduledAt)
            .Select(x => Map(x))
            .ToListAsync(cancellationToken);

    public async Task<FollowupDto> CreateAsync(UpsertFollowupDto request, CancellationToken cancellationToken)
    {
        var followup = new Followup
        {
            CompanyId = currentUser.CompanyId,
            UserId = currentUser.UserId,
            LeadId = request.LeadId,
            ScheduledAt = request.ScheduledAt.ToUniversalTime(),
            Status = request.Status.Trim(),
            Notes = request.Notes
        };
        context.Followups.Add(followup);
        await context.SaveChangesAsync(cancellationToken);
        return Map(followup);
    }

    public async Task<FollowupDto?> UpdateAsync(int id, UpsertFollowupDto request, CancellationToken cancellationToken)
    {
        var followup = await context.Followups.FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == currentUser.CompanyId && x.UserId == currentUser.UserId, cancellationToken);
        if (followup == null) return null;
        followup.LeadId = request.LeadId;
        followup.ScheduledAt = request.ScheduledAt.ToUniversalTime();
        followup.Status = request.Status.Trim();
        followup.Notes = request.Notes;
        followup.CompletedAt = followup.Status == "Completed" ? DateTime.UtcNow : null;
        await context.SaveChangesAsync(cancellationToken);
        return Map(followup);
    }

    public async Task<ApiResponse<PagedResult<FollowupResponseDto>>> GetFollowupsAsync(FollowupFilterDto filter, CancellationToken ct)
    {
        var page = Math.Max(1, filter.Page);
        var pageSize = Math.Clamp(filter.PageSize, 1, 100);
        var query = context.Followups.AsNoTracking().Where(x => x.CompanyId == currentUser.CompanyId && x.UserId == currentUser.UserId);
        if (!string.IsNullOrWhiteSpace(filter.Status)) query = query.Where(x => x.Status == filter.Status);
        if (filter.Scope == "overdue") query = query.Where(x => x.ScheduledAt < DateTime.UtcNow);
        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(x => x.ScheduledAt).Skip((page - 1) * pageSize).Take(pageSize).Select(x => MapResponse(x)).ToListAsync(ct);
        return ApiResponse<PagedResult<FollowupResponseDto>>.SuccessResult(PagedResult<FollowupResponseDto>.Create(items, total, page, pageSize), "Follow-ups retrieved successfully.");
    }

    public async Task<ApiResponse<FollowupResponseDto>> GetFollowupByIdAsync(int id, CancellationToken ct)
    {
        var followup = await context.Followups.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == currentUser.CompanyId && x.UserId == currentUser.UserId, ct);
        return followup == null ? ApiResponse<FollowupResponseDto>.FailureResult("Follow-up not found.") : ApiResponse<FollowupResponseDto>.SuccessResult(MapResponse(followup));
    }

    public async Task<ApiResponse<FollowupResponseDto>> CreateFollowupAsync(CreateFollowupDto dto, CancellationToken ct)
    {
        var followup = new Followup
        {
            CompanyId = currentUser.CompanyId,
            UserId = currentUser.UserId,
            LeadId = dto.LeadId,
            ScheduledAt = dto.ScheduledAt.ToUniversalTime(),
            Status = dto.Status.Trim(),
            Notes = dto.Notes
        };
        context.Followups.Add(followup);
        await context.SaveChangesAsync(ct);
        return ApiResponse<FollowupResponseDto>.SuccessResult(MapResponse(followup), "Follow-up created successfully.");
    }

    public async Task<ApiResponse<FollowupResponseDto>> UpdateFollowupAsync(int id, UpdateFollowupDto dto, CancellationToken ct)
    {
        var followup = await context.Followups.FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == currentUser.CompanyId && x.UserId == currentUser.UserId, ct);
        if (followup == null) return ApiResponse<FollowupResponseDto>.FailureResult("Follow-up not found.");
        followup.LeadId = dto.LeadId;
        followup.ScheduledAt = dto.ScheduledAt.ToUniversalTime();
        followup.Status = dto.Status.Trim();
        followup.Notes = dto.Notes;
        followup.CompletedAt = followup.Status == "Completed" ? DateTime.UtcNow : null;
        await context.SaveChangesAsync(ct);
        return ApiResponse<FollowupResponseDto>.SuccessResult(MapResponse(followup), "Follow-up updated successfully.");
    }

    public async Task<ApiResponse<FollowupResponseDto>> CompleteFollowupAsync(int id, CancellationToken ct)
    {
        var followup = await context.Followups.FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == currentUser.CompanyId && x.UserId == currentUser.UserId, ct);
        if (followup == null) return ApiResponse<FollowupResponseDto>.FailureResult("Follow-up not found.");
        followup.Status = "Completed";
        followup.CompletedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(ct);
        return ApiResponse<FollowupResponseDto>.SuccessResult(MapResponse(followup), "Follow-up completed successfully.");
    }

    public async Task<ApiResponse<bool>> DeleteFollowupAsync(int id, CancellationToken ct)
    {
        var followup = await context.Followups.FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == currentUser.CompanyId && x.UserId == currentUser.UserId, ct);
        if (followup == null) return ApiResponse<bool>.FailureResult("Follow-up not found.");
        context.Followups.Remove(followup);
        await context.SaveChangesAsync(ct);
        return ApiResponse<bool>.SuccessResult(true, "Follow-up deleted successfully.");
    }

    public async Task<bool> DeleteAsync(int id, CancellationToken cancellationToken)
    {
        var followup = await context.Followups.FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == currentUser.CompanyId && x.UserId == currentUser.UserId, cancellationToken);
        if (followup == null) return false;
        context.Followups.Remove(followup);
        await context.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static FollowupDto Map(Followup x) => new()
    {
        Id = x.Id, CompanyId = x.CompanyId, UserId = x.UserId, LeadId = x.LeadId,
        ScheduledAt = x.ScheduledAt, Status = x.Status, Notes = x.Notes,
        CompletedAt = x.CompletedAt, CreatedAt = x.CreatedAt
    };

    private static FollowupResponseDto MapResponse(Followup x) => new()
    {
        Id = x.Id,
        CompanyId = x.CompanyId,
        UserId = x.UserId,
        LeadId = x.LeadId,
        ScheduledAt = x.ScheduledAt,
        Status = x.Status,
        Notes = x.Notes,
        CompletedAt = x.CompletedAt,
        CreatedAt = x.CreatedAt
    };
}