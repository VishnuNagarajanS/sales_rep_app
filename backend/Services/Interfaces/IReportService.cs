using System.Threading;
using System.Threading.Tasks;

namespace backend.Services.Interfaces;

public interface IReportService
{
    Task<byte[]> GenerateExportReportAsync(int companyId, string? module, CancellationToken ct = default);
}
