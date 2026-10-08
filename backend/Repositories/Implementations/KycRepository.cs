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

    public async Task<InvestorKyc?> GetByEmailAsync(string email, int companyId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(email)) return null;
        var cleanEmail = email.Trim().ToLowerInvariant();
        return await _db.InvestorKycs
            .FirstOrDefaultAsync(k => k.CompanyId == companyId && k.Email.ToLower() == cleanEmail, ct);
    }

    public async Task<InvestorKyc?> GetByPhoneLast10Async(string phoneLast10, int companyId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(phoneLast10)) return null;
        var cleanDigits = new string(phoneLast10.Where(char.IsDigit).ToArray());
        if (cleanDigits.Length > 10) cleanDigits = cleanDigits[^10..];
        return await _db.InvestorKycs
            .FirstOrDefaultAsync(k => k.CompanyId == companyId && k.Phone != null && k.Phone.EndsWith(cleanDigits), ct);
    }

    public async Task<InvestorKyc?> GetByTokenAsync(string token, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;
        var cleanToken = token.Trim();
        var subToken = cleanToken.StartsWith("tok_", StringComparison.OrdinalIgnoreCase) ? cleanToken[4..] : cleanToken;
        var prefixedToken = cleanToken.StartsWith("tok_", StringComparison.OrdinalIgnoreCase) ? cleanToken : "tok_" + cleanToken;

        var tokenHash = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(cleanToken))).ToLowerInvariant();
        var subTokenHash = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(subToken))).ToLowerInvariant();

        return await _db.InvestorKycs.FirstOrDefaultAsync(k =>
            !k.IsRevoked &&
            (k.KycLinkToken == cleanToken || 
             k.KycLinkToken == subToken || 
             k.KycLinkToken == prefixedToken ||
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
