using backend.DTOs.Common;
using backend.DTOs.Irm;

namespace backend.Services.Interfaces;

public interface IOpportunityService
{
    Task<ApiResponse<List<OpportunityDto>>> GetAllAsync(int companyId, bool? isActive, CancellationToken ct = default);
    Task<ApiResponse<OpportunityDto>> GetByIdAsync(int id, int companyId, CancellationToken ct = default);
    Task<ApiResponse<OpportunityDto>> CreateAsync(int companyId, int irmId, CreateOpportunityDto dto, CancellationToken ct = default);
    Task<ApiResponse<OpportunityPitchDto>> PitchAsync(int opportunityId, int companyId, int irmId, PitchOpportunityDto dto, CancellationToken ct = default);
    Task<ApiResponse<OpportunityPitchDto>> CommitAsync(int opportunityId, int companyId, CommitOpportunityDto dto, CancellationToken ct = default);
    Task<ApiResponse<List<OpportunityPitchDto>>> GetPitchesAsync(int opportunityId, int companyId, CancellationToken ct = default);
}
