using backend.DTOs.Followups;

namespace backend.Services.Interfaces;

public interface IFollowupService
{
    Task<IReadOnlyList<FollowupDto>> GetAsync(CancellationToken cancellationToken);
    Task<FollowupDto> CreateAsync(UpsertFollowupDto request, CancellationToken cancellationToken);
    Task<FollowupDto?> UpdateAsync(int id, UpsertFollowupDto request, CancellationToken cancellationToken);
    Task<bool> DeleteAsync(int id, CancellationToken cancellationToken);
}