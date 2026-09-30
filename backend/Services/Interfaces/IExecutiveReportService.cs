using backend.DTOs.Reports;

namespace backend.Services.Interfaces;

public interface IExecutiveReportService
{
    Task<ExecutiveReportDto> GetAsync(DateTime? from, DateTime? to, CancellationToken cancellationToken);
}
