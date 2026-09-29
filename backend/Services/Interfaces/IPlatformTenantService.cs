using backend.DTOs.Common;
using backend.DTOs.SuperAdmin;

namespace backend.Services.Interfaces;

public interface IPlatformTenantService
{
    Task<ApiResponse<List<PlatformTenantDto>>> GetAllTenantsAsync(string? search, string? status, string? industry, CancellationToken ct = default);
    Task<ApiResponse<PlatformTenantDetailDto>> GetTenantByIdAsync(int id, CancellationToken ct = default);
    Task<ApiResponse<PlatformTenantDto>> CreateTenantWizardAsync(CreateTenantWizardDto dto, CancellationToken ct = default);
    Task<ApiResponse<PlatformTenantDto>> UpdateTenantAsync(int id, UpdateTenantDto dto, CancellationToken ct = default);
    Task<ApiResponse<bool>> UpdateTenantStatusAsync(int id, string status, CancellationToken ct = default);
    Task<ApiResponse<List<string>>> UpdateTenantFeaturesAsync(int id, List<string> features, CancellationToken ct = default);
    Task<ApiResponse<bool>> DeleteTenantAsync(int id, CancellationToken ct = default);
    Task<ApiResponse<object>> ImpersonateTenantAsync(int id, CancellationToken ct = default);
}
