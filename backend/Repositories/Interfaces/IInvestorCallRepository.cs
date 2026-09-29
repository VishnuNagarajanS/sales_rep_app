using backend.Models.Entities;

namespace backend.Repositories.Interfaces;

public interface IInvestorCallRepository
{
    Task<List<InvestorCall>> GetAllAsync(int companyId, int? irmId, CancellationToken ct = default);
    Task<InvestorCall> CreateAsync(InvestorCall call, CancellationToken ct = default);
    Task<List<InvestorCall>> GetByInvestorIdAsync(int investorId, int companyId, CancellationToken ct = default);
}
