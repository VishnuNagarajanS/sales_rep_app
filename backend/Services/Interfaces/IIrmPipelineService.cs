using backend.DTOs.Common;
using backend.DTOs.Irm;

namespace backend.Services.Interfaces;

public interface IIrmPipelineService
{
    Task<ApiResponse<IrmPipelineBoardDto>> GetBoardAsync(int companyId, int? irmId, CancellationToken ct = default);
    Task<ApiResponse<IrmPipelineCardDto>> MoveStageAsync(int cardId, int companyId, int irmId, MoveIrmStageDto dto, CancellationToken ct = default);
    Task<ApiResponse<IrmPipelineCardDto>> LogActivityAsync(int cardId, int companyId, int irmId, LogIrmActivityDto dto, CancellationToken ct = default);
}
