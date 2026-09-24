using backend.DTOs.Common;
using backend.DTOs.Consultations;

namespace backend.Services.Interfaces;

public interface IConsultationService
{
    Task<ApiResponse<PagedResult<ConsultationResponseDto>>> GetConsultationsAsync(string? status, string? search, int page, int pageSize, CancellationToken ct);
    Task<ApiResponse<ConsultationResponseDto>> GetConsultationByIdAsync(int id, CancellationToken ct);
    Task<ApiResponse<ConsultationResponseDto>> ScheduleConsultationAsync(ScheduleConsultationDto dto, CancellationToken ct);
    Task<ApiResponse<ConsultationResponseDto>> UpdateConsultationAsync(int id, UpdateConsultationDto dto, CancellationToken ct);
    Task<ApiResponse<bool>> DeleteConsultationAsync(int id, CancellationToken ct);
}
