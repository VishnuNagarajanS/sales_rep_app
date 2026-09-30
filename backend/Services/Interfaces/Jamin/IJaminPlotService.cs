using backend.DTOs.Common;
using backend.DTOs.Jamin;

namespace backend.Services.Interfaces.Jamin;

public interface IJaminPlotService
{
    Task<ApiResponse<List<JaminPlotResponseDto>>> GetPlotsAsync(int? projectId = null, string? status = null, CancellationToken ct = default);
    Task<ApiResponse<JaminPlotResponseDto>> GetPlotByIdAsync(int id, CancellationToken ct = default);
    Task<ApiResponse<JaminPlotResponseDto>> CreatePlotAsync(CreateJaminPlotDto dto, CancellationToken ct = default);
    Task<ApiResponse<JaminPlotResponseDto>> UpdatePlotAsync(int id, UpdateJaminPlotDto dto, CancellationToken ct = default);
    Task<ApiResponse<JaminPlotResponseDto>> HoldPlotAsync(int id, HoldPlotRequestDto dto, CancellationToken ct = default);
    Task<ApiResponse<JaminPlotResponseDto>> ReleasePlotHoldAsync(int id, CancellationToken ct = default);
}
