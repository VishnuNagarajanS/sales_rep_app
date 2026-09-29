using backend.DTOs.Common;
using backend.DTOs.SuperAdmin;

namespace backend.Services.Interfaces;

public interface IPlatformPackageService
{
    Task<ApiResponse<List<SubscriptionPackageDto>>> GetAllPackagesAsync(CancellationToken ct = default);
    Task<ApiResponse<SubscriptionPackageDto>> GetPackageByIdAsync(int id, CancellationToken ct = default);
    Task<ApiResponse<SubscriptionPackageDto>> CreatePackageAsync(CreatePackageDto dto, CancellationToken ct = default);
    Task<ApiResponse<SubscriptionPackageDto>> UpdatePackageAsync(int id, UpdatePackageDto dto, CancellationToken ct = default);
    Task<ApiResponse<bool>> DeletePackageAsync(int id, CancellationToken ct = default);
    List<FeatureCatalogItemDto> GetFeatureCatalog();
}
