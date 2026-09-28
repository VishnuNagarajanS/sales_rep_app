using backend.Models.Entities;

namespace backend.Repositories.Interfaces;

public interface IInvestorRepository
{
    Task<List<Investor>> GetAllAsync(int companyId, string? status, string? assetClass, int? irmId, CancellationToken ct = default);
    Task<Investor?> GetByIdAsync(int id, int companyId, CancellationToken ct = default);
    Task<Investor> CreateAsync(Investor investor, CancellationToken ct = default);
    Task<Investor> UpdateAsync(Investor investor, CancellationToken ct = default);
    Task DeleteAsync(int id, CancellationToken ct = default);
    Task<bool> ExistsAsync(int id, int companyId, CancellationToken ct = default);
}
