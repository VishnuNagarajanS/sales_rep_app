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
    private readonly backend.Services.Email.IEmailService _emailService;

    public AdminUserService(ApplicationDbContext context, backend.Services.Email.IEmailService emailService)
    {
        _context = context;
        _emailService = emailService;
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
                RoleName = u.Role != null ? u.Role.Name : "Unknown",
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
                RoleName = u.Role != null ? u.Role.Name : "Unknown",
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
            Status = request.Status,
            CreatedAt = DateTime.UtcNow
        };

        if (request.Status == backend.Models.Enums.UserStatus.Invited)
        {
            var loginUrl = "http://localhost:5173/auth/login";
            var emailBody = $@"
                <h3>Welcome to GHL India Ventures, {request.Name}!</h3>
                <p>You have been invited to join the platform as a <b>{role.Name}</b>.</p>
                <p>Your temporary password is: <strong>{request.Password}</strong></p>
                <p>Please login at <a href='{loginUrl}'>{loginUrl}</a> and change your password.</p>";
                
            await _emailService.SendEmailAsync(request.Email, "Invitation to GHL India Ventures", emailBody);
        }

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

    public async Task<ApiResponse<AdminUserDto>> TransferDataAndUpdateRoleAsync(int companyId, int oldUserId, TransferRoleRequestDto request, CancellationToken cancellationToken = default)
    {
        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var oldUser = await _context.Users
                .Include(u => u.Role)
                .FirstOrDefaultAsync(u => u.CompanyId == companyId && u.Id == oldUserId, cancellationToken);

            if (oldUser == null)
                return ApiResponse<AdminUserDto>.FailureResult("Old user not found.");

            var newUser = await _context.Users
                .FirstOrDefaultAsync(u => u.CompanyId == companyId && u.Id == request.NewUserId, cancellationToken);

            if (newUser == null)
                return ApiResponse<AdminUserDto>.FailureResult("New user not found.");

            var newRole = await _context.Roles.FindAsync(new object[] { request.NewRoleId }, cancellationToken);
            if (newRole == null)
                return ApiResponse<AdminUserDto>.FailureResult("Invalid New Role ID.");

            // Transfer Leads
            var leads = await _context.Leads
                .Where(l => l.CompanyId == companyId && l.AssignedAgentId == oldUserId)
                .ToListAsync(cancellationToken);

            foreach (var lead in leads)
            {
                lead.AssignedAgentId = request.NewUserId;
                
                // Add Assignment History
                _context.LeadAssignmentHistories.Add(new backend.Models.Entities.LeadAssignmentHistory
                {
                    LeadId = lead.Id,
                    FromAgentId = oldUserId,
                    ToAgentId = request.NewUserId,
                    AssignedById = oldUserId, // System fallback
                    Method = "manual",
                    AssignedAt = DateTime.UtcNow
                });
            }

            // Transfer Followups
            var followups = await _context.Followups
                .Where(f => f.CompanyId == companyId && f.AssignedAgentId == oldUserId)
                .ToListAsync(cancellationToken);

            foreach (var f in followups)
            {
                f.AssignedAgentId = request.NewUserId;
            }

            // Update Old User Role
            oldUser.Role = newRole;
            oldUser.RoleId = request.NewRoleId;
            oldUser.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            var dto = new AdminUserDto
            {
                Id = oldUser.Id,
                Name = oldUser.Name,
                Email = oldUser.Email,
                Phone = oldUser.Phone,
                Status = oldUser.Status,
                CreatedAt = oldUser.CreatedAt,
                LastLoginAt = oldUser.LastLoginAt,
                AvatarUrl = oldUser.AvatarUrl,
                RoleId = oldUser.RoleId,
                RoleName = oldUser.Role.Name
            };

            return ApiResponse<AdminUserDto>.SuccessResult(dto, "Transferred active data and updated role successfully.");
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiResponse<AdminUserDto>.FailureResult($"Transfer failed: {ex.Message}");
        }
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
