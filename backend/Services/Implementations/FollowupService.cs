using backend.Data;
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
}