using backend.DTOs.Admin;
using backend.DTOs.Common;

namespace backend.Services.Interfaces;

public interface IAdminUserService
{
    Task<ApiResponse<List<AdminUserDto>>> GetUsersByCompanyAsync(int companyId, CancellationToken cancellationToken = default);
    Task<ApiResponse<AdminUserDto>> GetUserByIdAsync(int companyId, int userId, CancellationToken cancellationToken = default);
    Task<ApiResponse<AdminUserDto>> CreateUserAsync(int companyId, CreateUserRequestDto request, CancellationToken cancellationToken = default);
    Task<ApiResponse<AdminUserDto>> UpdateUserAsync(int companyId, int userId, UpdateUserRequestDto request, CancellationToken cancellationToken = default);
    Task<ApiResponse<bool>> DeleteUserAsync(int companyId, int userId, CancellationToken cancellationToken = default);
}
