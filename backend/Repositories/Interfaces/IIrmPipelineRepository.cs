using backend.Models.Entities;

namespace backend.Repositories.Interfaces;

public interface IIrmPipelineRepository
{
    Task<List<IrmPipelineCard>> GetAllAsync(int companyId, int? irmId, CancellationToken ct = default);
    Task<IrmPipelineCard?> GetByIdAsync(int id, int companyId, CancellationToken ct = default);
    Task<IrmPipelineCard?> GetByInvestorIdAsync(int investorId, int companyId, CancellationToken ct = default);
    Task<IrmPipelineCard> CreateAsync(IrmPipelineCard card, CancellationToken ct = default);
    Task<IrmPipelineCard> UpdateAsync(IrmPipelineCard card, CancellationToken ct = default);
}
