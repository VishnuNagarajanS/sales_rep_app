using backend.DTOs.Common;
using backend.DTOs.Irm;

namespace backend.Services.Interfaces;

public interface IIrmFollowupService
{
    Task<ApiResponse<List<FollowupDto>>> GetAllAsync(int companyId, int? assignedToId, string? status, CancellationToken ct = default);
    Task<ApiResponse<FollowupDto>> CreateAsync(int companyId, int assignedToId, string assignedToRole, CreateFollowupDto dto, CancellationToken ct = default);
    Task<ApiResponse<FollowupDto>> CompleteAsync(int id, int companyId, CompleteFollowupDto dto, CancellationToken ct = default);
    Task<ApiResponse<FollowupDto>> RescheduleAsync(int id, int companyId, RescheduleFollowupDto dto, CancellationToken ct = default);
}
