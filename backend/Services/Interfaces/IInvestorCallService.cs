using backend.DTOs.Common;
using backend.DTOs.Irm;

namespace backend.Services.Interfaces;

public interface IInvestorCallService
{
    Task<ApiResponse<List<CallLogDto>>> GetAllAsync(int companyId, int? irmId, CancellationToken ct = default);
    Task<ApiResponse<CallLogDto>> LogCallAsync(int companyId, int irmId, LogCallDto dto, CancellationToken ct = default);
}
