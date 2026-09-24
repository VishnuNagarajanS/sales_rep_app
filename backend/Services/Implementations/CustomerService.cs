using backend.DTOs.Common;
using backend.DTOs.Customers;
using backend.Services.Interfaces;

namespace backend.Services.Implementations;

public sealed class CustomerService : ICustomerService
{
    public Task<ApiResponse<PagedResult<CustomerResponseDto>>> GetCustomersAsync(string? status, string? search, int page, int pageSize, CancellationToken ct)
        => Task.FromResult(ApiResponse<PagedResult<CustomerResponseDto>>.FailureResult("Customer module is not implemented in this build."));

    public Task<ApiResponse<Customer360Dto>> GetCustomer360ByIdAsync(int id, CancellationToken ct)
        => Task.FromResult(ApiResponse<Customer360Dto>.FailureResult("Customer module is not implemented in this build."));

    public Task<ApiResponse<CustomerResponseDto>> CreateCustomerAsync(CreateCustomerDto dto, CancellationToken ct)
        => Task.FromResult(ApiResponse<CustomerResponseDto>.FailureResult("Customer module is not implemented in this build."));

    public Task<ApiResponse<CustomerResponseDto>> UpdateCustomerAsync(int id, UpdateCustomerDto dto, CancellationToken ct)
        => Task.FromResult(ApiResponse<CustomerResponseDto>.FailureResult("Customer module is not implemented in this build."));
}
