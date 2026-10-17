using backend.Data;
using backend.Models.Entities;
using backend.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace backend.Repositories.Implementations;

public class OpportunityRepository : IOpportunityRepository
{
    private readonly ApplicationDbContext _db;

    public OpportunityRepository(ApplicationDbContext db) => _db = db;

    public async Task<List<InvestmentOpportunity>> GetAllAsync(int companyId, bool? isActive, CancellationToken ct = default)
    {
        var query = _db.InvestmentOpportunities.Where(o => o.CompanyId == companyId);
        if (isActive.HasValue) query = query.Where(o => o.IsActive == isActive);
        return await query.OrderByDescending(o => o.CreatedAt).ToListAsync(ct);
    }

    public async Task<InvestmentOpportunity?> GetByIdAsync(int id, int companyId, CancellationToken ct = default)
        => await _db.InvestmentOpportunities
            .FirstOrDefaultAsync(o => o.Id == id && o.CompanyId == companyId, ct);


    public async Task<InvestmentOpportunity> CreateAsync(InvestmentOpportunity opportunity, CancellationToken ct = default)
    {
        _db.InvestmentOpportunities.Add(opportunity);
        await _db.SaveChangesAsync(ct);
        return opportunity;
    }

    public async Task<InvestmentOpportunity> UpdateAsync(InvestmentOpportunity opportunity, CancellationToken ct = default)
    {
        opportunity.UpdatedAt = DateTime.UtcNow;
        _db.InvestmentOpportunities.Update(opportunity);
        await _db.SaveChangesAsync(ct);
        return opportunity;
    }

    public Task<OpportunityPitch> AddPitchAsync(OpportunityPitch pitch, CancellationToken ct = default)
        => Task.FromResult(pitch);

    public Task<OpportunityPitch?> GetPitchAsync(int opportunityId, int investorId, CancellationToken ct = default)
        => Task.FromResult<OpportunityPitch?>(null);

    public Task<OpportunityPitch> UpdatePitchAsync(OpportunityPitch pitch, CancellationToken ct = default)
        => Task.FromResult(pitch);

    public Task<List<OpportunityPitch>> GetPitchesByOpportunityAsync(int opportunityId, CancellationToken ct = default)
        => Task.FromResult(new List<OpportunityPitch>());
}
