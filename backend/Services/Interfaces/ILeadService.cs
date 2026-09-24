using backend.DTOs.Common;
using backend.DTOs.Leads;

namespace backend.Services.Interfaces;

public interface ILeadService
{
    Task<IReadOnlyList<LeadDto>> GetAsync(CancellationToken cancellationToken);
    Task<LeadDto> CreateAsync(UpsertLeadDto request, CancellationToken cancellationToken);
    Task<LeadDto?> UpdateAsync(int id, UpsertLeadDto request, CancellationToken cancellationToken);
    Task<bool> DeleteAsync(int id, CancellationToken cancellationToken);

    Task<ApiResponse<PagedResult<LeadResponseDto>>> GetActiveLeadsAsync(LeadFilterDto filter, CancellationToken ct);
    Task<ApiResponse<LeadResponseDto>> GetLeadByIdAsync(int id, CancellationToken ct);
    Task<ApiResponse<LeadResponseDto>> CreateLeadAsync(CreateLeadDto dto, CancellationToken ct);
    Task<ApiResponse<LeadResponseDto>> UpdateLeadAsync(int id, UpdateLeadDto dto, CancellationToken ct);
    Task<ApiResponse<object>> ConvertLeadAsync(int id, ConvertLeadDto dto, CancellationToken ct);
    Task<ApiResponse<PagedResult<LeadResponseDto>>> GetNotInterestedLeadsAsync(int page, int pageSize, CancellationToken ct);
    Task<ApiResponse<PagedResult<LeadResponseDto>>> GetJunkLeadsAsync(int page, int pageSize, CancellationToken ct);
    Task<ApiResponse<LeadResponseDto>> ReengageLeadAsync(int id, CancellationToken ct);
}