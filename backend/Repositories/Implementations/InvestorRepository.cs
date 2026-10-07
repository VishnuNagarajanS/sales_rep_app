using backend.Data;
using backend.Models.Entities;
using backend.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace backend.Repositories.Implementations;

public class InvestorRepository : IInvestorRepository
{
    private readonly ApplicationDbContext _db;

    public InvestorRepository(ApplicationDbContext db) => _db = db;

    public async Task<List<Investor>> GetAllAsync(int companyId, string? status, string? assetClass, int? irmId, CancellationToken ct = default)
    {
        var query = _db.Investors
            .Where(i => i.CompanyId == companyId);

        if (!string.IsNullOrEmpty(status))
            query = query.Where(i => i.Status.ToString() == status);

        if (!string.IsNullOrEmpty(assetClass))
            query = query.Where(i => i.PreferredAssetClass == assetClass);

        if (irmId.HasValue)
            query = query.Where(i => i.AssignedIrmId == irmId);

        return await query.OrderByDescending(i => i.CreatedAt).ToListAsync(ct);
    }

    public async Task<Investor?> GetByIdAsync(int id, int companyId, CancellationToken ct = default)
        => await _db.Investors
            .Include(i => i.Consultations)
            .Include(i => i.Followups)
            .FirstOrDefaultAsync(i => i.Id == id && i.CompanyId == companyId, ct);


    public async Task<Investor> CreateAsync(Investor investor, CancellationToken ct = default)
    {
        _db.Investors.Add(investor);
        await _db.SaveChangesAsync(ct);
        return investor;
    }

    public async Task<Investor> UpdateAsync(Investor investor, CancellationToken ct = default)
    {
        investor.UpdatedAt = DateTime.UtcNow;
        _db.Investors.Update(investor);
        await _db.SaveChangesAsync(ct);
        return investor;
    }

    public async Task DeleteAsync(int id, CancellationToken ct = default)
    {
        var investor = await _db.Investors.FindAsync(new object[] { id }, ct);
        if (investor != null)
        {
            _db.Investors.Remove(investor);
            await _db.SaveChangesAsync(ct);
        }
    }

    public async Task<bool> ExistsAsync(int id, int companyId, CancellationToken ct = default)
        => await _db.Investors.AnyAsync(i => i.Id == id && i.CompanyId == companyId, ct);
}
