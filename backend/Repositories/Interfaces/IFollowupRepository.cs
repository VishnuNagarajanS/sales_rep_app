using backend.Models.Entities;

namespace backend.Repositories.Interfaces;

public interface IFollowupRepository
{
    Task<List<Followup>> GetAllAsync(int companyId, int? assignedToId, string? role, string? status, CancellationToken ct = default);
    Task<Followup?> GetByIdAsync(int id, int companyId, CancellationToken ct = default);
    Task<Followup> CreateAsync(Followup followup, CancellationToken ct = default);
    Task<Followup> UpdateAsync(Followup followup, CancellationToken ct = default);
    Task<List<Followup>> GetByInvestorIdAsync(int investorId, int companyId, CancellationToken ct = default);
}
