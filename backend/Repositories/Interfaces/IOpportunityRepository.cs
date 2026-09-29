using backend.Models.Entities;

namespace backend.Repositories.Interfaces;

public interface IOpportunityRepository
{
    Task<List<InvestmentOpportunity>> GetAllAsync(int companyId, bool? isActive, CancellationToken ct = default);
    Task<InvestmentOpportunity?> GetByIdAsync(int id, int companyId, CancellationToken ct = default);
    Task<InvestmentOpportunity> CreateAsync(InvestmentOpportunity opportunity, CancellationToken ct = default);
    Task<InvestmentOpportunity> UpdateAsync(InvestmentOpportunity opportunity, CancellationToken ct = default);
    Task<OpportunityPitch> AddPitchAsync(OpportunityPitch pitch, CancellationToken ct = default);
    Task<OpportunityPitch?> GetPitchAsync(int opportunityId, int investorId, CancellationToken ct = default);
    Task<OpportunityPitch> UpdatePitchAsync(OpportunityPitch pitch, CancellationToken ct = default);
    Task<List<OpportunityPitch>> GetPitchesByOpportunityAsync(int opportunityId, CancellationToken ct = default);
}
