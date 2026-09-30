using backend.Data;
using backend.Models.Entities;
using backend.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace backend.Repositories.Implementations;

public class InvestorCallRepository : IInvestorCallRepository
{
    private readonly ApplicationDbContext _db;

    public InvestorCallRepository(ApplicationDbContext db) => _db = db;

    public async Task<List<InvestorCall>> GetAllAsync(int companyId, int? irmId, CancellationToken ct = default)
    {
        var query = _db.InvestorCalls.Where(c => c.CompanyId == companyId);
        if (irmId.HasValue) query = query.Where(c => c.IrmId == irmId);
        return await query.OrderByDescending(c => c.CalledAt).ToListAsync(ct);
    }

    public async Task<InvestorCall> CreateAsync(InvestorCall call, CancellationToken ct = default)
    {
        _db.InvestorCalls.Add(call);
        await _db.SaveChangesAsync(ct);
        return call;
    }

    public async Task<List<InvestorCall>> GetByInvestorIdAsync(int investorId, int companyId, CancellationToken ct = default)
        => await _db.InvestorCalls
            .Where(c => c.InvestorId == investorId && c.CompanyId == companyId)
            .OrderByDescending(c => c.CalledAt).ToListAsync(ct);
}
