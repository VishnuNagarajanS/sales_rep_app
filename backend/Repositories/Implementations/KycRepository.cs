using backend.Data;
using backend.Models.Entities;
using backend.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace backend.Repositories.Implementations;

public class KycRepository : IKycRepository
{
    private readonly ApplicationDbContext _db;

    public KycRepository(ApplicationDbContext db) => _db = db;

    public async Task<List<InvestorKyc>> GetAllAsync(int companyId, string? status, CancellationToken ct = default)
    {
        var query = _db.InvestorKycs.Where(k => k.CompanyId == companyId);
        if (!string.IsNullOrEmpty(status))
            query = query.Where(k => k.Status.ToString() == status);
        return await query.OrderByDescending(k => k.CreatedAt).ToListAsync(ct);
    }

    public async Task<InvestorKyc?> GetByIdAsync(int id, int companyId, CancellationToken ct = default)
        => await _db.InvestorKycs.FirstOrDefaultAsync(k => k.Id == id && k.CompanyId == companyId, ct);

    public async Task<InvestorKyc?> GetByInvestorIdAsync(int investorId, int companyId, CancellationToken ct = default)
        => await _db.InvestorKycs.FirstOrDefaultAsync(k => k.InvestorId == investorId && k.CompanyId == companyId, ct);

    public async Task<InvestorKyc?> GetByTokenAsync(string token, CancellationToken ct = default)
        => await _db.InvestorKycs.FirstOrDefaultAsync(k => k.KycLinkToken == token && k.KycLinkExpiresAt > DateTime.UtcNow, ct);

    public async Task<InvestorKyc> CreateAsync(InvestorKyc kyc, CancellationToken ct = default)
    {
        _db.InvestorKycs.Add(kyc);
        await _db.SaveChangesAsync(ct);
        return kyc;
    }

    public async Task<InvestorKyc> UpdateAsync(InvestorKyc kyc, CancellationToken ct = default)
    {
        kyc.UpdatedAt = DateTime.UtcNow;
        _db.InvestorKycs.Update(kyc);
        await _db.SaveChangesAsync(ct);
        return kyc;
    }
}
