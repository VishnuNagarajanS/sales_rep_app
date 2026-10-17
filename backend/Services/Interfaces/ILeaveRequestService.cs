using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using backend.DTOs.Admin;
using backend.DTOs.Common;

namespace backend.Services.Interfaces;

public interface ILeaveRequestService
{
    Task<ApiResponse<List<LeaveRequestDto>>> GetLeaveRequestsAsync(
        int companyId,
        int? userId,
        string? status,
        string? type,
        string? handoverState,
        string? search,
        DateOnly? from,
        DateOnly? to,
        CancellationToken cancellationToken = default);

    Task<ApiResponse<LeaveRequestDetailDto>> GetLeaveRequestDetailAsync(int companyId, int id, CancellationToken cancellationToken = default);
    Task<ApiResponse<List<LeaveBalanceDto>>> GetUserLeaveBalancesAsync(int companyId, int userId, CancellationToken cancellationToken = default);
    Task<ApiResponse<LeaveConflictsDto>> GetLeaveConflictsAsync(int companyId, int leaveRequestId, CancellationToken cancellationToken = default);
    Task<ApiResponse<LeaveRequestDto>> CreateLeaveRequestAsync(int companyId, int userId, CreateLeaveRequestDto dto, CancellationToken cancellationToken = default);
    Task<ApiResponse<LeaveRequestDto>> UpdateLeaveRequestAsync(int companyId, int userId, int id, UpdateLeaveRequestDto dto, CancellationToken cancellationToken = default);
    Task<ApiResponse<LeaveRequestDto>> CancelLeaveRequestAsync(int companyId, int userId, int id, CancellationToken cancellationToken = default);
    Task<ApiResponse<LeaveRequestDto>> ApproveLeaveRequestAsync(int companyId, int adminId, int leaveRequestId, ApproveLeaveRequestDto dto, CancellationToken cancellationToken = default);
    Task<ApiResponse<LeaveRequestDto>> RejectLeaveRequestAsync(int companyId, int adminId, int leaveRequestId, RejectLeaveRequestDto dto, CancellationToken cancellationToken = default);
    Task<ApiResponse<LeaveRequestDto>> MarkHandoverNotNeededAsync(int companyId, int adminId, int leaveRequestId, HandoverNotNeededDto dto, CancellationToken cancellationToken = default);
}
