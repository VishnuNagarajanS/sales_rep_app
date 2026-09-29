using backend.DTOs.Calls;
using backend.DTOs.Common;

namespace backend.Services.Interfaces;

public interface ICallService
{
    Task<PagedResult<CallRecordDto>> GetAsync(int page, int pageSize, string? direction, string? disposition, DateTime? from, DateTime? to, CancellationToken cancellationToken);
    Task<ApiResponse<CallRecordDto>> LogAsync(LogCallDto request, CancellationToken cancellationToken);
    Task<ApiResponse<CallRecordDto>> ProcessDispositionAsync(CallDispositionDto request, CancellationToken cancellationToken);
}
