using backend.Models.Entities;

namespace backend.Repositories.Interfaces;

public interface IKycRepository
{
    Task<List<InvestorKyc>> GetAllAsync(int companyId, string? status, CancellationToken ct = default);
    Task<InvestorKyc?> GetByIdAsync(int id, int companyId, CancellationToken ct = default);
    Task<InvestorKyc?> GetByInvestorIdAsync(int investorId, int companyId, CancellationToken ct = default);
    Task<InvestorKyc?> GetByTokenAsync(string token, CancellationToken ct = default);
    Task<InvestorKyc> CreateAsync(InvestorKyc kyc, CancellationToken ct = default);
    Task<InvestorKyc> UpdateAsync(InvestorKyc kyc, CancellationToken ct = default);
}
