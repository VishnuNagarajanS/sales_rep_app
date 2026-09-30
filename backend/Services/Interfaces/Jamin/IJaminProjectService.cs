using backend.DTOs.Common;
using backend.DTOs.Jamin;

namespace backend.Services.Interfaces.Jamin;

public interface IJaminProjectService
{
    Task<ApiResponse<List<JaminProjectResponseDto>>> GetProjectsAsync(string? status = null, CancellationToken ct = default);
    Task<ApiResponse<JaminProjectResponseDto>> GetProjectByIdAsync(int id, CancellationToken ct = default);
    Task<ApiResponse<JaminProjectResponseDto>> CreateProjectAsync(CreateJaminProjectDto dto, CancellationToken ct = default);
    Task<ApiResponse<JaminProjectResponseDto>> UpdateProjectAsync(int id, UpdateJaminProjectDto dto, CancellationToken ct = default);
    Task<ApiResponse<bool>> DeleteProjectAsync(int id, CancellationToken ct = default);
}
