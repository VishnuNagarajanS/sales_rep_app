using backend.DTOs.Common;
using backend.DTOs.Irm;

namespace backend.Services.Interfaces;

public interface IIrmDashboardService
{
    Task<ApiResponse<IrmDashboardMetricsDto>> GetMetricsAsync(int companyId, int? irmId, CancellationToken ct = default);
}
