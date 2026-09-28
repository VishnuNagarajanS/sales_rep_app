using backend.Data;
using backend.DTOs.Admin;
using backend.DTOs.Common;
using backend.Models.Entities;
using backend.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using BCrypt.Net;

namespace backend.Services.Implementations;

public class AdminUserService : IAdminUserService
{
    private readonly ApplicationDbContext _context;

    public AdminUserService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<ApiResponse<List<AdminUserDto>>> GetUsersByCompanyAsync(int companyId, CancellationToken cancellationToken = default)
    {
        var users = await _context.Users
            .Include(u => u.Role)
            .Where(u => u.CompanyId == companyId)
            .Select(u => new AdminUserDto
            {
                Id = u.Id,
                Name = u.Name,
                Email = u.Email,
                Phone = u.Phone,
                RoleId = u.RoleId,
                RoleName = u.Role.Name,
                Status = u.Status,
                LastLoginAt = u.LastLoginAt,
                AvatarUrl = u.AvatarUrl,
                CreatedAt = u.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return ApiResponse<List<AdminUserDto>>.SuccessResult(users);
    }

    public async Task<ApiResponse<AdminUserDto>> GetUserByIdAsync(int companyId, int userId, CancellationToken cancellationToken = default)
    {
        var user = await _context.Users
            .Include(u => u.Role)
            .Where(u => u.CompanyId == companyId && u.Id == userId)
            .Select(u => new AdminUserDto
            {
                Id = u.Id,
                Name = u.Name,
                Email = u.Email,
                Phone = u.Phone,
                RoleId = u.RoleId,
                RoleName = u.Role.Name,
                Status = u.Status,
                LastLoginAt = u.LastLoginAt,
                AvatarUrl = u.AvatarUrl,
                CreatedAt = u.CreatedAt
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (user == null)
            return ApiResponse<AdminUserDto>.FailureResult("User not found.");

        return ApiResponse<AdminUserDto>.SuccessResult(user);
    }

    public async Task<ApiResponse<AdminUserDto>> CreateUserAsync(int companyId, CreateUserRequestDto request, CancellationToken cancellationToken = default)
    {
        // Check if email already exists
        if (await _context.Users.AnyAsync(u => u.Email == request.Email, cancellationToken))
        {
            return ApiResponse<AdminUserDto>.FailureResult("Email is already registered.");
        }

        // Check if role exists
        var role = await _context.Roles.FindAsync(new object[] { request.RoleId }, cancellationToken);
        if (role == null)
        {
            return ApiResponse<AdminUserDto>.FailureResult("Invalid Role ID.");
        }

        var newUser = new User
        {
            Name = request.Name,
            Email = request.Email,
            Phone = request.Phone,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            RoleId = request.RoleId,
            CompanyId = companyId,
            CreatedAt = DateTime.UtcNow
        };

        _context.Users.Add(newUser);
        await _context.SaveChangesAsync(cancellationToken);

        var dto = new AdminUserDto
        {
            Id = newUser.Id,
            Name = newUser.Name,
            Email = newUser.Email,
            Phone = newUser.Phone,
            RoleId = newUser.RoleId,
            RoleName = role.Name,
            Status = newUser.Status,
            CreatedAt = newUser.CreatedAt
        };

        return ApiResponse<AdminUserDto>.SuccessResult(dto, "User created successfully.");
    }

    public async Task<ApiResponse<AdminUserDto>> UpdateUserAsync(int companyId, int userId, UpdateUserRequestDto request, CancellationToken cancellationToken = default)
    {
        var user = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.CompanyId == companyId && u.Id == userId, cancellationToken);

        if (user == null)
            return ApiResponse<AdminUserDto>.FailureResult("User not found.");

        if (user.RoleId != request.RoleId)
        {
            var role = await _context.Roles.FindAsync(new object[] { request.RoleId }, cancellationToken);
            if (role == null) return ApiResponse<AdminUserDto>.FailureResult("Invalid Role ID.");
            user.Role = role;
        }

        user.Name = request.Name;
        user.Phone = request.Phone;
        user.RoleId = request.RoleId;
        user.Status = request.Status;
        user.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        var dto = new AdminUserDto
        {
            Id = user.Id,
            Name = user.Name,
            Email = user.Email,
            Phone = user.Phone,
            RoleId = user.RoleId,
            RoleName = user.Role.Name,
            Status = user.Status,
            LastLoginAt = user.LastLoginAt,
            AvatarUrl = user.AvatarUrl,
            CreatedAt = user.CreatedAt
        };

        return ApiResponse<AdminUserDto>.SuccessResult(dto, "User updated successfully.");
    }

    public async Task<ApiResponse<bool>> DeleteUserAsync(int companyId, int userId, CancellationToken cancellationToken = default)
    {
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.CompanyId == companyId && u.Id == userId, cancellationToken);

        if (user == null)
            return ApiResponse<bool>.FailureResult("User not found.");

        _context.Users.Remove(user);
        await _context.SaveChangesAsync(cancellationToken);

        return ApiResponse<bool>.SuccessResult(true, "User deleted successfully.");
    }
}
