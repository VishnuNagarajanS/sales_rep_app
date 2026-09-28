using backend.DTOs.Common;
using backend.DTOs.Irm;

namespace backend.Services.Interfaces;

public interface IConsultationService
{
    Task<ApiResponse<List<ConsultationDto>>> GetAllAsync(int companyId, int? consultantId, string? status, DateTime? from, DateTime? to, CancellationToken ct = default);
    Task<ApiResponse<ConsultationDto>> GetByIdAsync(int id, int companyId, CancellationToken ct = default);
    Task<ApiResponse<ConsultationDto>> CreateAsync(int companyId, int consultantId, CreateConsultationDto dto, CancellationToken ct = default);
    Task<ApiResponse<ConsultationDto>> UpdateAsync(int id, int companyId, UpdateConsultationDto dto, CancellationToken ct = default);
    Task<ApiResponse<ConsultationDto>> RecordOutcomeAsync(int id, int companyId, ConsultationOutcomeDto dto, CancellationToken ct = default);
    Task<ApiResponse<bool>> DeleteAsync(int id, int companyId, CancellationToken ct = default);
}
