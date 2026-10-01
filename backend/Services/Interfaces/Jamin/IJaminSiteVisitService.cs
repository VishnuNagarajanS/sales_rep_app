using backend.DTOs.Common;
using backend.DTOs.Jamin;

namespace backend.Services.Interfaces.Jamin;

public interface IJaminSiteVisitService
{
    Task<ApiResponse<List<JaminSiteVisitDto>>> GetSiteVisitsAsync(int? agentId = null, string? status = null, CancellationToken ct = default);
    Task<ApiResponse<JaminSiteVisitDto>> ScheduleSiteVisitAsync(ScheduleSiteVisitRequestDto dto, CancellationToken ct = default);
    Task<ApiResponse<JaminSiteVisitDto>> ConfirmSiteVisitAsync(int id, CancellationToken ct = default);
    Task<ApiResponse<JaminSiteVisitDto>> CompleteSiteVisitAsync(int id, UpdateSiteVisitOutcomeDto dto, CancellationToken ct = default);
    Task<ApiResponse<List<JaminSiteVisitDto>>> GetLeadSiteVisitsAsync(int leadId, CancellationToken ct = default);
    Task<ApiResponse<bool>> DeleteSiteVisitAsync(int id, CancellationToken ct = default);
}

