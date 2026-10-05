using backend.DTOs.WorkHandover;
using backend.Models.Entities;

namespace backend.Services.Interfaces;

public interface IWorkHandoverService
{
    Task<List<WorkHandoverCandidateDto>> GetCandidatesAsync(int companyId, string roleCode, CancellationToken ct = default);
    Task<WorkHandoverPreviewDto> GetPreviewAsync(int companyId, int fromUserId, int toUserId, CancellationToken ct = default);
    Task<WorkHandoverDto> StartHandoverAsync(int companyId, int actorId, string actorName, string actorEmail, StartWorkHandoverRequestDto request, CancellationToken ct = default);
    Task<List<WorkHandoverDto>> GetActiveHandoversAsync(int companyId, CancellationToken ct = default);
    Task<List<WorkHandoverDto>> GetHandoverHistoryAsync(int companyId, CancellationToken ct = default);
    Task<WorkHandoverDto?> GetHandoverByIdAsync(int companyId, int id, CancellationToken ct = default);
    Task<WorkHandoverDto> EndHandoverAsync(int companyId, int id, int actorId, string actorName, string actorEmail, CancellationToken ct = default);
    Task<WorkHandoverDto> ReturnSelectedItemsAsync(int companyId, int id, List<int> itemIds, int actorId, string actorName, string actorEmail, CancellationToken ct = default);
    Task<WorkHandover?> GetActiveHandoverForCoveringUserAsync(int companyId, int coveringUserId, CancellationToken ct = default);
    Task<WorkHandover?> GetActiveHandoverForCoveredUserAsync(int companyId, int coveredUserId, CancellationToken ct = default);
    Task<MyWorkHandoverStatusDto> GetMyStatusAsync(int companyId, int userId, CancellationToken ct = default);
}
