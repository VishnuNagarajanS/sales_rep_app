using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.Customers;
using backend.Models.Entities;
using backend.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Implementations;

public sealed class CustomerService : ICustomerService
{
    private readonly ApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public CustomerService(ApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<ApiResponse<PagedResult<CustomerResponseDto>>> GetCustomersAsync(string? status, string? search, int page, int pageSize, CancellationToken ct)
    {
        var companyId = _currentUser.CompanyId;
        var role = _currentUser.RoleCode;
        var userId = _currentUser.UserId;

        var query = _context.Customers
            .AsNoTracking()
            .Include(c => c.AssignedToUser)
            .Where(c => companyId == 0 || c.CompanyId == companyId);

        // Sales executive sees assigned customers only
        if (role == "sales_executive")
        {
            query = query.Where(c => c.AssignedToUserId == userId);
        }

        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(c => c.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(c =>
                c.Name.ToLower().Contains(term) ||
                c.Phone.ToLower().Contains(term) ||
                c.Email.ToLower().Contains(term) ||
                (c.Location != null && c.Location.ToLower().Contains(term)));
        }

        var totalCount = await query.CountAsync(ct);

        var items = await query
            .OrderByDescending(c => c.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new CustomerResponseDto
            {
                Id = c.Id,
                CompanyId = c.CompanyId,
                AssignedToUserId = c.AssignedToUserId,
                AssignedToUserName = c.AssignedToUser != null ? c.AssignedToUser.Name : null,
                Name = c.Name,
                Email = c.Email,
                Phone = c.Phone,
                Location = c.Location,
                Status = c.Status,
                Notes = c.Notes,
                CreatedAt = c.CreatedAt,
                UpdatedAt = c.UpdatedAt
            })
            .ToListAsync(ct);

        var paged = PagedResult<CustomerResponseDto>.Create(items, totalCount, page, pageSize);

        return ApiResponse<PagedResult<CustomerResponseDto>>.SuccessResult(paged);
    }

    public async Task<ApiResponse<Customer360Dto>> GetCustomer360ByIdAsync(int id, CancellationToken ct)
    {
        var companyId = _currentUser.CompanyId;
        var role = _currentUser.RoleCode;
        var userId = _currentUser.UserId;

        var customer = await _context.Customers
            .AsNoTracking()
            .Include(c => c.AssignedToUser)
            .FirstOrDefaultAsync(c => c.Id == id && (companyId == 0 || c.CompanyId == companyId), ct);

        if (customer == null)
            return ApiResponse<Customer360Dto>.FailureResult("Customer not found.");

        if (role == "sales_executive" && customer.AssignedToUserId != userId)
            return ApiResponse<Customer360Dto>.FailureResult("Access denied. You can only view your assigned customers.");

        var dto = new Customer360Dto
        {
            Id = customer.Id,
            CompanyId = customer.CompanyId,
            AssignedToUserId = customer.AssignedToUserId,
            AssignedToUserName = customer.AssignedToUser?.Name,
            Name = customer.Name,
            Email = customer.Email,
            Phone = customer.Phone,
            Location = customer.Location,
            Status = customer.Status,
            Notes = customer.Notes,
            CreatedAt = customer.CreatedAt
        };

        return ApiResponse<Customer360Dto>.SuccessResult(dto);
    }

    public async Task<ApiResponse<CustomerResponseDto>> CreateCustomerAsync(CreateCustomerDto dto, CancellationToken ct)
    {
        var companyId = _currentUser.CompanyId;
        var userId = _currentUser.UserId;

        var customer = new Customer
        {
            CompanyId = companyId > 0 ? companyId : 1,
            AssignedToUserId = userId > 0 ? userId : null,
            Name = dto.Name.Trim(),
            Email = dto.Email.Trim(),
            Phone = dto.Phone.Trim(),
            Location = dto.Location?.Trim(),
            Status = string.IsNullOrWhiteSpace(dto.Status) ? "Active" : dto.Status.Trim(),
            Notes = dto.Notes,
            CreatedAt = DateTime.UtcNow
        };

        _context.Customers.Add(customer);
        await _context.SaveChangesAsync(ct);

        var user = customer.AssignedToUserId.HasValue
            ? await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == customer.AssignedToUserId.Value, ct)
            : null;

        return ApiResponse<CustomerResponseDto>.SuccessResult(new CustomerResponseDto
        {
            Id = customer.Id,
            CompanyId = customer.CompanyId,
            AssignedToUserId = customer.AssignedToUserId,
            AssignedToUserName = user?.Name,
            Name = customer.Name,
            Email = customer.Email,
            Phone = customer.Phone,
            Location = customer.Location,
            Status = customer.Status,
            Notes = customer.Notes,
            CreatedAt = customer.CreatedAt
        });
    }

    public async Task<ApiResponse<CustomerResponseDto>> UpdateCustomerAsync(int id, UpdateCustomerDto dto, CancellationToken ct)
    {
        var companyId = _currentUser.CompanyId;

        var customer = await _context.Customers
            .FirstOrDefaultAsync(c => c.Id == id && (companyId == 0 || c.CompanyId == companyId), ct);

        if (customer == null)
            return ApiResponse<CustomerResponseDto>.FailureResult("Customer not found.");

        customer.Name = dto.Name.Trim();
        customer.Email = dto.Email.Trim();
        customer.Phone = dto.Phone.Trim();
        customer.Location = dto.Location?.Trim();
        customer.Status = dto.Status.Trim();
        customer.Notes = dto.Notes;
        customer.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(ct);

        return ApiResponse<CustomerResponseDto>.SuccessResult(new CustomerResponseDto
        {
            Id = customer.Id,
            CompanyId = customer.CompanyId,
            AssignedToUserId = customer.AssignedToUserId,
            Name = customer.Name,
            Email = customer.Email,
            Phone = customer.Phone,
            Location = customer.Location,
            Status = customer.Status,
            Notes = customer.Notes,
            CreatedAt = customer.CreatedAt,
            UpdatedAt = customer.UpdatedAt
        });
    }
}
