using backend.DTOs.Common;
using backend.DTOs.Customers;

namespace backend.Services.Interfaces;

public interface ICustomerService
{
    Task<ApiResponse<PagedResult<CustomerResponseDto>>> GetCustomersAsync(string? status, string? search, int page, int pageSize, CancellationToken ct);
    Task<ApiResponse<Customer360Dto>> GetCustomer360ByIdAsync(int id, CancellationToken ct);
    Task<ApiResponse<CustomerResponseDto>> CreateCustomerAsync(CreateCustomerDto dto, CancellationToken ct);
    Task<ApiResponse<CustomerResponseDto>> UpdateCustomerAsync(int id, UpdateCustomerDto dto, CancellationToken ct);
}
