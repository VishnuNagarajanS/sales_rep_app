using backend.DTOs.Common;
using backend.DTOs.Leads;

namespace backend.Services.Interfaces;

public interface ILeadService
{
    Task<ApiResponse<PagedResult<LeadResponseDto>>> GetActiveLeadsAsync(LeadFilterDto filter, CancellationToken ct = default);
    Task<ApiResponse<LeadResponseDto>> GetLeadByIdAsync(int id, CancellationToken ct = default);
    Task<ApiResponse<LeadResponseDto>> CreateLeadAsync(CreateLeadDto dto, CancellationToken ct = default);
    Task<ApiResponse<LeadResponseDto>> UpdateLeadAsync(int id, UpdateLeadDto dto, CancellationToken ct = default);
    Task<ApiResponse<object>> ConvertLeadAsync(int id, ConvertLeadDto dto, CancellationToken ct = default);
    Task<ApiResponse<PagedResult<LeadResponseDto>>> GetNotInterestedLeadsAsync(int page, int pageSize, CancellationToken ct = default);
    Task<ApiResponse<PagedResult<LeadResponseDto>>> GetJunkLeadsAsync(int page, int pageSize, CancellationToken ct = default);
    Task<ApiResponse<LeadResponseDto>> ReengageLeadAsync(int id, CancellationToken ct = default);
}
