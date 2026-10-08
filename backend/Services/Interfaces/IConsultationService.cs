using backend.DTOs.Common;
using backend.DTOs.Consultations;
using backend.DTOs.Irm;

namespace backend.Services.Interfaces;

public interface IConsultationService
{
    // Sales Executive endpoints
    Task<ApiResponse<PagedResult<ConsultationResponseDto>>> GetConsultationsAsync(string? status, string? search, int page = 1, int pageSize = 10, CancellationToken ct = default);
    Task<ApiResponse<ConsultationResponseDto>> GetConsultationByIdAsync(int id, CancellationToken ct = default);
    Task<ApiResponse<ConsultationResponseDto>> ScheduleConsultationAsync(ScheduleConsultationDto dto, CancellationToken ct = default);
    Task<ApiResponse<ConsultationResponseDto>> UpdateConsultationAsync(int id, backend.DTOs.Consultations.UpdateConsultationDto dto, CancellationToken ct = default);
    Task<ApiResponse<List<IrmUserDto>>> GetCompanyIrmsAsync(CancellationToken ct = default);

    // IRM endpoints
    Task<ApiResponse<List<ConsultationDto>>> GetAllAsync(int companyId, int? consultantId, string? status, DateTime? from, DateTime? to, CancellationToken ct = default);
    Task<ApiResponse<ConsultationDto>> GetByIdAsync(int id, int companyId, CancellationToken ct = default);
    Task<ApiResponse<ConsultationDto>> CreateAsync(int companyId, int consultantId, CreateConsultationDto dto, CancellationToken ct = default);
    Task<ApiResponse<ConsultationDto>> UpdateAsync(int id, int companyId, backend.DTOs.Irm.UpdateConsultationDto dto, CancellationToken ct = default);
    Task<ApiResponse<ConsultationDto>> RecordOutcomeAsync(int id, int companyId, ConsultationOutcomeDto dto, CancellationToken ct = default);
    Task<ApiResponse<bool>> DeleteAsync(int id, int companyId, CancellationToken ct = default);
}
