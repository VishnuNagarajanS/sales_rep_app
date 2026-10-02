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
        var cleanToken = token.Trim();
        var subToken = cleanToken.StartsWith("tok_") ? cleanToken[4..] : cleanToken;
        var tokenHash = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(cleanToken))).ToLowerInvariant();
        var subTokenHash = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(subToken))).ToLowerInvariant();

        return await _db.InvestorKycs.FirstOrDefaultAsync(k =>
            !k.IsRevoked &&
            (k.KycLinkToken == cleanToken || k.KycLinkToken == subToken || (k.KycLinkToken != null && ("tok_" + k.KycLinkToken) == cleanToken) ||
             (k.KycTokenHash != null && (k.KycTokenHash == tokenHash || k.KycTokenHash == subTokenHash))) &&
            (!k.KycLinkExpiresAt.HasValue || k.KycLinkExpiresAt.Value > DateTime.UtcNow), ct);
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
