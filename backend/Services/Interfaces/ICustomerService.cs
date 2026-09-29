using backend.DTOs.Common;
using backend.DTOs.Customers;

namespace backend.Services.Interfaces;

public interface ICustomerService
{
    Task<ApiResponse<PagedResult<CustomerResponseDto>>> GetCustomersAsync(string? status, string? search, int page = 1, int pageSize = 10, CancellationToken ct = default);
    Task<ApiResponse<Customer360Dto>> GetCustomer360ByIdAsync(int id, CancellationToken ct = default);
    Task<ApiResponse<CustomerResponseDto>> CreateCustomerAsync(CreateCustomerDto dto, CancellationToken ct = default);
    Task<ApiResponse<CustomerResponseDto>> UpdateCustomerAsync(int id, UpdateCustomerDto dto, CancellationToken ct = default);
}
