using backend.DTOs.Common;
using backend.DTOs.Irm;

namespace backend.Services.Interfaces;

public interface IIrmOtherService
{
    Task<ApiResponse<List<IrmOtherRecordDto>>> GetOtherRecordsAsync(int companyId, int? irmId, string? moduleFilter, string? search, CancellationToken ct = default);
    ApiResponse<Dictionary<string, List<string>>> GetCallOutcomes();
    Task<ContactOtherMatcher> GetOtherMatcherAsync(int companyId, string? module = null, CancellationToken ct = default);
}
