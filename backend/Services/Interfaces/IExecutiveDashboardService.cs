using backend.DTOs.Dashboard;

namespace backend.Services.Interfaces;

public interface IExecutiveDashboardService
{
    Task<ExecutiveDashboardDto> GetAsync(CancellationToken cancellationToken);
}
