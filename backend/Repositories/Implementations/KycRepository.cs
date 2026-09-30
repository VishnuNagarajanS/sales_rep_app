using backend.Data;
using backend.Models.Entities;
using backend.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace backend.Repositories.Implementations;

public class KycRepository : IKycRepository
{
    private readonly ApplicationDbContext _db;

    public KycRepository(ApplicationDbContext db) => _db = db;

    public Task<List<InvestorKyc>> GetAllAsync(int companyId, string? status, CancellationToken ct = default)
        => GetAllAsync(companyId, status, null, ct);

    public async Task<List<InvestorKyc>> GetAllAsync(int companyId, string? status, int? irmId, CancellationToken ct = default)
    {
        var query = _db.InvestorKycs
            .Include(k => k.Investor)
            .Where(k => k.CompanyId == companyId);

        if (irmId.HasValue && irmId.Value > 0)
        {
            query = query.Where(k => k.IrmId == irmId.Value || (k.IrmId == null && k.Investor.AssignedIrmId == irmId.Value));
        }

        if (!string.IsNullOrEmpty(status))
            query = query.Where(k => k.Status.ToString() == status);

        return await query.OrderByDescending(k => k.CreatedAt).ToListAsync(ct);
    }

    public async Task<InvestorKyc?> GetByIdAsync(int id, int companyId, CancellationToken ct = default)
        => await _db.InvestorKycs.FirstOrDefaultAsync(k => k.Id == id && k.CompanyId == companyId, ct);

    public async Task<InvestorKyc?> GetByInvestorIdAsync(int investorId, int companyId, CancellationToken ct = default)
        => await _db.InvestorKycs.FirstOrDefaultAsync(k => k.InvestorId == investorId && k.CompanyId == companyId, ct);

    public async Task<InvestorKyc?> GetByTokenAsync(string token, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;
        var direct = await _db.InvestorKycs.FirstOrDefaultAsync(k => k.KycLinkToken == token && k.KycLinkExpiresAt > DateTime.UtcNow, ct);
        if (direct != null) return direct;

        var subToken = token.Replace("tok_", "").Trim();
        var prefix = subToken.Length >= 8 ? subToken[..8] : subToken;
        var match = await _db.InvestorKycs.FirstOrDefaultAsync(k => 
            k.KycLinkToken != null && 
            k.KycLinkExpiresAt > DateTime.UtcNow &&
            k.KycLinkToken.StartsWith(prefix), ct);
        if (match != null) return match;

        // Fallback: match by trailing slug (e.g. tok_74210020_dhina -> dhina)
        if (subToken.Contains('_'))
        {
            var slug = subToken.Split('_').Last().Trim().ToLower();
            if (slug.Length >= 3)
            {
                var slugMatch = await _db.InvestorKycs.FirstOrDefaultAsync(k =>
                    k.InvestorName.ToLower().Contains(slug) ||
                    k.Email.ToLower().Contains(slug), ct);
                if (slugMatch != null) return slugMatch;
            }
        }

        return null;
    }

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
