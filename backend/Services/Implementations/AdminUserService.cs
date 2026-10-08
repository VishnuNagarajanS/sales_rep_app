using backend.Authentication.Interfaces;
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
    private readonly ICurrentUserService _currentUser;

    public AdminUserService(
        ApplicationDbContext context,
        backend.Services.Email.IEmailService emailService,
        ICurrentUserService currentUser)
    {
        _context = context;
        _emailService = emailService;
        _currentUser = currentUser;
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
    Console.WriteLine($"[AdminUserService] CreateUser: email={request.Email}, roleId={request.RoleId}, status={request.Status}, companyId={companyId}");

        // Check if email already exists
        if (await _context.Users.AnyAsync(u => u.Email == request.Email, cancellationToken))
        {
            Console.WriteLine($"[AdminUserService] CreateUser FAILED: email already exists: {request.Email}");
            return ApiResponse<AdminUserDto>.FailureResult("Email is already registered.");
        }

        var role = await _context.Roles.FirstOrDefaultAsync(r => r.Id == request.RoleId, cancellationToken);
        if (role == null)
        {
            Console.WriteLine($"[AdminUserService] CreateUser FAILED: role not found for roleId={request.RoleId}");
            return ApiResponse<AdminUserDto>.FailureResult("Invalid Role ID.");
        }

        if (companyId == 2 && role.Code is not ("company_admin" or "sales_executive"))
            return ApiResponse<AdminUserDto>.FailureResult("Jamin users can only have Company Admin or Sales Executive roles.");
        Console.WriteLine($"[AdminUserService] CreateUser: role found = {role.Name} (id={role.Id}, code={role.Code})");

        var newUser = new User
        {
            Name = request.Name,
            Email = request.Email,
            Phone = request.Phone,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            RoleId = role.Id,
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

        // Audit Trail
        var audit = new AuditLog
        {
            CompanyId = companyId,
            Timestamp = DateTime.UtcNow,
            ActorName = !string.IsNullOrWhiteSpace(_currentUser.Name) ? _currentUser.Name : "Company Admin",
            ActorEmail = !string.IsNullOrWhiteSpace(_currentUser.Email) ? _currentUser.Email : "admin@ghlindiaventures.com",
            Action = request.Status == backend.Models.Enums.UserStatus.Invited ? "USER_INVITED" : "USER_PROVISIONED",
            EntityType = "User",
            EntityId = newUser.Id.ToString(),
            Details = $"Added team member {newUser.Name} ({newUser.Email}) with role {role.Name}.",
            Module = "Team Management",
            Status = "success"
        };
        _context.AuditLogs.Add(audit);

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
        Console.WriteLine($"[AdminUserService] UpdateUser: userId={userId}, companyId={companyId}, roleId={request.RoleId}, status={request.Status}");

        var user = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.CompanyId == companyId && u.Id == userId, cancellationToken);

        if (user == null)
        {
            Console.WriteLine($"[AdminUserService] UpdateUser FAILED: user not found userId={userId} companyId={companyId}");
            return ApiResponse<AdminUserDto>.FailureResult("User not found.");
        }

        var oldRoleName = user.Role?.Name ?? "Unknown";

        var role = await _context.Roles.FirstOrDefaultAsync(r => r.Id == request.RoleId, cancellationToken);
        if (role == null)
        {
            Console.WriteLine($"[AdminUserService] UpdateUser FAILED: role not found roleId={request.RoleId}");
            return ApiResponse<AdminUserDto>.FailureResult("Invalid Role ID.");
        }

        if (companyId == 2 && role.Code is not ("company_admin" or "sales_executive"))
            return ApiResponse<AdminUserDto>.FailureResult("Jamin users can only have Company Admin or Sales Executive roles.");
        Console.WriteLine($"[AdminUserService] UpdateUser: resolved role to {role.Name} (id={role.Id}, code={role.Code})");
        user.Role = role;
        user.RoleId = role.Id;

        user.Name = request.Name;
        user.Phone = request.Phone;
        user.Status = request.Status;
        user.UpdatedAt = DateTime.UtcNow;

        // Audit Trail
        var updateAudit = new AuditLog
        {
            CompanyId = companyId,
            Timestamp = DateTime.UtcNow,
            ActorName = !string.IsNullOrWhiteSpace(_currentUser.Name) ? _currentUser.Name : "Company Admin",
            ActorEmail = !string.IsNullOrWhiteSpace(_currentUser.Email) ? _currentUser.Email : "admin@ghlindiaventures.com",
            Action = "USER_UPDATED",
            EntityType = "User",
            EntityId = user.Id.ToString(),
            Details = $"Updated team member {user.Name} ({user.Email}) - Role: {user.Role?.Name ?? oldRoleName}, Status: {user.Status}.",
            Module = "Team Management",
            Status = "success"
        };
        _context.AuditLogs.Add(updateAudit);

        await _context.SaveChangesAsync(cancellationToken);

        var dto = new AdminUserDto
        {
            Id = user.Id,
            Name = user.Name,
            Email = user.Email,
            Phone = user.Phone,
            RoleId = user.RoleId,
            RoleName = role.Name,
            Status = user.Status,
            LastLoginAt = user.LastLoginAt,
            AvatarUrl = user.AvatarUrl,
            CreatedAt = user.CreatedAt
        };

        Console.WriteLine($"[AdminUserService] UpdateUser: SaveChanges OK → returning roleId={user.RoleId}, roleName={dto.RoleName}");

        return ApiResponse<AdminUserDto>.SuccessResult(dto, "User updated successfully.");
    }

    public async Task<ApiResponse<bool>> DeleteUserAsync(int companyId, int userId, CancellationToken cancellationToken = default)
    {
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.CompanyId == companyId && u.Id == userId, cancellationToken);

        if (user == null)
            return ApiResponse<bool>.FailureResult("User not found.");

        _context.Users.Remove(user);

        // Audit Trail
        var deleteAudit = new AuditLog
        {
            CompanyId = companyId,
            Timestamp = DateTime.UtcNow,
            ActorName = !string.IsNullOrWhiteSpace(_currentUser.Name) ? _currentUser.Name : "Company Admin",
            ActorEmail = !string.IsNullOrWhiteSpace(_currentUser.Email) ? _currentUser.Email : "admin@ghlindiaventures.com",
            Action = "USER_DELETED",
            EntityType = "User",
            EntityId = user.Id.ToString(),
            Details = $"Deleted team member {user.Name} ({user.Email}).",
            Module = "Team Management",
            Status = "success"
        };
        _context.AuditLogs.Add(deleteAudit);

        await _context.SaveChangesAsync(cancellationToken);

        return ApiResponse<bool>.SuccessResult(true, "User deleted successfully.");
    }
}
