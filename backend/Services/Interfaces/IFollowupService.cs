using backend.DTOs.Common;
using backend.DTOs.Followups;

namespace backend.Services.Interfaces;

public interface IFollowupService
{
    Task<IReadOnlyList<FollowupDto>> GetAsync(CancellationToken cancellationToken);
    Task<FollowupDto> CreateAsync(UpsertFollowupDto request, CancellationToken cancellationToken);
    Task<FollowupDto?> UpdateAsync(int id, UpsertFollowupDto request, CancellationToken cancellationToken);
    Task<bool> DeleteAsync(int id, CancellationToken cancellationToken);

    Task<ApiResponse<PagedResult<FollowupResponseDto>>> GetFollowupsAsync(FollowupFilterDto filter, CancellationToken ct);
    Task<ApiResponse<FollowupResponseDto>> GetFollowupByIdAsync(int id, CancellationToken ct);
    Task<ApiResponse<FollowupResponseDto>> CreateFollowupAsync(CreateFollowupDto dto, CancellationToken ct);
    Task<ApiResponse<FollowupResponseDto>> UpdateFollowupAsync(int id, UpdateFollowupDto dto, CancellationToken ct);
    Task<ApiResponse<FollowupResponseDto>> CompleteFollowupAsync(int id, CancellationToken ct);
    Task<ApiResponse<bool>> DeleteFollowupAsync(int id, CancellationToken ct);
}