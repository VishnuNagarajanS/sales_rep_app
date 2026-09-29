using backend.DTOs.Common;
using backend.DTOs.SuperAdmin;

namespace backend.Services.Interfaces;

public interface IPlatformSystemService
{
    Task<ApiResponse<SystemDiagnosticsDto>> GetSystemDiagnosticsAsync(CancellationToken ct = default);
    Task<ApiResponse<List<BroadcastAnnouncementDto>>> GetAnnouncementsAsync(CancellationToken ct = default);
    Task<ApiResponse<BroadcastAnnouncementDto>> CreateAnnouncementAsync(CreateAnnouncementDto dto, CancellationToken ct = default);
    Task<ApiResponse<bool>> ToggleAnnouncementAsync(int id, bool isActive, CancellationToken ct = default);
    Task<ApiResponse<bool>> DeleteAnnouncementAsync(int id, CancellationToken ct = default);
    Task<ApiResponse<MaintenanceStatusDto>> GetMaintenanceStatusAsync(CancellationToken ct = default);
    Task<ApiResponse<MaintenanceStatusDto>> SetMaintenanceStatusAsync(SetMaintenanceDto dto, CancellationToken ct = default);
    Task<ApiResponse<object>> ExportPlatformSnapshotAsync(CancellationToken ct = default);
}
