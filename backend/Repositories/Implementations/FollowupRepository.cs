using backend.Data;
using backend.Models.Entities;
using backend.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace backend.Repositories.Implementations;

public class FollowupRepository : IFollowupRepository
{
    private readonly ApplicationDbContext _db;

    public FollowupRepository(ApplicationDbContext db) => _db = db;

    public async Task<List<Followup>> GetAllAsync(int companyId, int? assignedToId, string? role, string? status, CancellationToken ct = default)
    {
        var query = _db.Followups.Where(f => f.CompanyId == companyId);
        if (assignedToId.HasValue) query = query.Where(f => f.AssignedAgentId == assignedToId);
        if (!string.IsNullOrEmpty(role)) query = query.Where(f => f.AssignedToRole == role);
        if (!string.IsNullOrEmpty(status)) query = query.Where(f => f.Status.ToString() == status);
        return await query.OrderByDescending(f => f.ScheduledAt).ToListAsync(ct);
    }

    public async Task<Followup?> GetByIdAsync(int id, int companyId, CancellationToken ct = default)
        => await _db.Followups.FirstOrDefaultAsync(f => f.Id == id && f.CompanyId == companyId, ct);

    public async Task<Followup> CreateAsync(Followup followup, CancellationToken ct = default)
    {
        _db.Followups.Add(followup);
        await _db.SaveChangesAsync(ct);
        return followup;
    }

    public async Task<Followup> UpdateAsync(Followup followup, CancellationToken ct = default)
    {
        followup.UpdatedAt = DateTime.UtcNow;
        _db.Followups.Update(followup);
        await _db.SaveChangesAsync(ct);
        return followup;
    }

    public async Task<List<Followup>> GetByInvestorIdAsync(int investorId, int companyId, CancellationToken ct = default)
        => await _db.Followups
            .Where(f => f.InvestorId == investorId && f.CompanyId == companyId)
            .OrderByDescending(f => f.ScheduledAt).ToListAsync(ct);
}
