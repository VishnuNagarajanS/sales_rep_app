using backend.DTOs.Common;
using backend.DTOs.Jamin;

namespace backend.Services.Interfaces.Jamin;

public interface IJaminLeadService
{
    Task<ApiResponse<JaminLeadDto>> ProcessWalkTheLandBookingAsync(WalkTheLandBookingDto dto, CancellationToken ct = default);
    Task<ApiResponse<JaminLeadDto>> ProcessWebsiteMessageInquiryAsync(WebsiteMessageInquiryDto dto, CancellationToken ct = default);
    Task<ApiResponse<List<JaminLeadDto>>> GetJaminLeadsAsync(int? agentId = null, string? status = null, CancellationToken ct = default);
    Task<ApiResponse<JaminLeadDto>> GetJaminLeadByIdAsync(int id, CancellationToken ct = default);
    Task<ApiResponse<JaminLeadDetailDto>> GetJaminLeadDetailByIdAsync(int id, CancellationToken ct = default);
    Task<ApiResponse<JaminLeadDto>> CreateLeadAsync(CreateJaminLeadDto dto, CancellationToken ct = default);
    Task<ApiResponse<JaminLeadDto>> UpdateLeadAsync(int id, UpdateJaminLeadDto dto, CancellationToken ct = default);
    Task<ApiResponse<bool>> AssignLeadAsync(int id, AssignJaminLeadDto dto, CancellationToken ct = default);
    Task<ApiResponse<bool>> ScheduleFollowupAsync(int leadId, JaminScheduleFollowupDto dto, CancellationToken ct = default);
}
