using backend.DTOs.Common;
using backend.DTOs.SuperAdmin;

namespace backend.Services.Interfaces;

public interface IPlatformCallConfigService
{
    Task<ApiResponse<List<TenantDidMappingDto>>> GetAllDidsAsync(int? tenantId, string? status, CancellationToken ct = default);
    Task<ApiResponse<TenantDidMappingDto>> CreateDidAsync(CreateDidMappingDto dto, CancellationToken ct = default);
    Task<ApiResponse<TenantDidMappingDto>> UpdateDidAsync(int id, UpdateDidMappingDto dto, CancellationToken ct = default);
    Task<ApiResponse<bool>> DeleteDidAsync(int id, CancellationToken ct = default);
    Task<ApiResponse<PlatformCarrierSettingsDto>> GetCarrierSettingsAsync(CancellationToken ct = default);
    Task<ApiResponse<PlatformCarrierSettingsDto>> UpdateCarrierSettingsAsync(UpdateCarrierSettingsDto dto, CancellationToken ct = default);
    Task<ApiResponse<CarrierTestResultDto>> TestCarrierConnectionAsync(CancellationToken ct = default);
}
