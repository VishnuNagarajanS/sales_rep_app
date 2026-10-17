using backend.DTOs.Common;
using backend.DTOs.Irm;

namespace backend.Services.Interfaces;

public interface IInvestorService
{
    Task<ApiResponse<List<InvestorDto>>> GetAllAsync(int companyId, string? status, string? assetClass, int? irmId, CancellationToken ct = default);
    Task<ApiResponse<InvestorActivityListDto>> GetByIdAsync(int id, int companyId, CancellationToken ct = default);
    Task<ApiResponse<InvestorDto>> UpdateAsync(int id, int companyId, UpdateInvestorDto dto, CancellationToken ct = default);
    Task<ApiResponse<bool>> DeleteAsync(int id, int companyId, CancellationToken ct = default);
}
