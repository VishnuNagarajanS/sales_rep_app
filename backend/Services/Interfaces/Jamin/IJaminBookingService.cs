using backend.DTOs.Common;
using backend.DTOs.Jamin;

namespace backend.Services.Interfaces.Jamin;

public interface IJaminBookingService
{
    Task<ApiResponse<List<JaminBookingResponseDto>>> GetBookingsAsync(int? projectId = null, string? status = null, int? agentId = null, int? leadId = null, int? customerId = null, CancellationToken ct = default);
    Task<ApiResponse<JaminBookingResponseDto>> GetBookingByIdAsync(int id, CancellationToken ct = default);
    Task<ApiResponse<JaminBookingResponseDto>> CreateBookingAsync(CreateJaminBookingDto dto, CancellationToken ct = default);
    Task<ApiResponse<JaminBookingResponseDto>> UpdateBookingStatusAsync(int id, UpdateJaminBookingStatusDto dto, CancellationToken ct = default);
}
