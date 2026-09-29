using backend.DTOs.Common;
using backend.DTOs.Followups;

namespace backend.Services.Interfaces;

public interface IFollowupService
{
    Task<ApiResponse<PagedResult<FollowupResponseDto>>> GetFollowupsAsync(FollowupFilterDto filter, CancellationToken ct = default);
    Task<ApiResponse<FollowupResponseDto>> GetFollowupByIdAsync(int id, CancellationToken ct = default);
    Task<ApiResponse<FollowupResponseDto>> CreateFollowupAsync(CreateFollowupDto dto, CancellationToken ct = default);
    Task<ApiResponse<FollowupResponseDto>> UpdateFollowupAsync(int id, UpdateFollowupDto dto, CancellationToken ct = default);
    Task<ApiResponse<FollowupResponseDto>> CompleteFollowupAsync(int id, CancellationToken ct = default);
    Task<ApiResponse<bool>> DeleteFollowupAsync(int id, CancellationToken ct = default);
}
