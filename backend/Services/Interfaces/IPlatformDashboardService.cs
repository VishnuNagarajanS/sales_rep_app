using backend.DTOs.Common;
using backend.DTOs.SuperAdmin;

namespace backend.Services.Interfaces;

public interface IPlatformDashboardService
{
    Task<ApiResponse<PlatformMetricsDto>> GetPlatformMetricsAsync(CancellationToken ct = default);
    Task<ApiResponse<List<FleetCompanyStatDto>>> GetFleetCompanyStatsAsync(CancellationToken ct = default);
}
