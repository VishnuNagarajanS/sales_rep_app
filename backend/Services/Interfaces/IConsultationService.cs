using backend.DTOs.Common;
using backend.DTOs.Consultations;

namespace backend.Services.Interfaces;

public interface IConsultationService
{
    Task<ApiResponse<PagedResult<ConsultationResponseDto>>> GetConsultationsAsync(string? status, string? search, int page = 1, int pageSize = 10, CancellationToken ct = default);
    Task<ApiResponse<ConsultationResponseDto>> GetConsultationByIdAsync(int id, CancellationToken ct = default);
    Task<ApiResponse<ConsultationResponseDto>> ScheduleConsultationAsync(ScheduleConsultationDto dto, CancellationToken ct = default);
    Task<ApiResponse<ConsultationResponseDto>> UpdateConsultationAsync(int id, UpdateConsultationDto dto, CancellationToken ct = default);
}
