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
    private readonly backend.Services.Interfaces.ICompanyClock _clock;

    public AdminUserService(ApplicationDbContext context, backend.Services.Email.IEmailService emailService, backend.Services.Interfaces.ICompanyClock clock)
    {
        _context = context;
        _emailService = emailService;
        _clock = clock;
    }

    public async Task<ApiResponse<List<AdminUserDto>>> GetUsersByCompanyAsync(int companyId, CancellationToken cancellationToken = default)
    {
        var users = await _context.Users
            .Include(u => u.Role)
            .Where(u => u.CompanyId == companyId)
            .ToListAsync(cancellationToken);

        var today = await _clock.GetCompanyTodayAsync(companyId, cancellationToken);

        var activeHandovers = await _context.WorkHandovers
            .Include(wh => wh.CoveringUser)
            .Where(wh => wh.CompanyId == companyId && wh.Status == "active")
            .ToListAsync(cancellationToken);

        var approvedLeaves = await _context.LeaveRequests
            .Where(lr => lr.CompanyId == companyId && lr.Status == "Approved" && lr.StartDate <= today && today <= lr.EndDate)
            .ToListAsync(cancellationToken);

        var dtos = users.Select(u =>
        {
            var handover = activeHandovers.FirstOrDefault(wh => wh.OriginalUserId == u.Id);
            var leave = approvedLeaves.FirstOrDefault(lr => lr.UserId == u.Id);

            return new AdminUserDto
            {
                Id = u.Id,
                Name = u.Name,
                Email = u.Email,
                Phone = u.Phone,
                RoleId = u.RoleId,
                RoleName = u.Role != null ? u.Role.Name : "Unknown",
                RoleCode = u.Role != null ? u.Role.Code : "sales_executive",
                Status = u.Status,
                LastLoginAt = u.LastLoginAt,
                AvatarUrl = u.AvatarUrl,
                CreatedAt = u.CreatedAt,
                IsCovered = handover != null,
                CoveredBy = handover?.CoveringUser?.Name,
                OnLeave = leave != null,
                LeaveUntil = leave?.EndDate
            };
        }).ToList();

        return ApiResponse<List<AdminUserDto>>.SuccessResult(dtos);
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
                RoleCode = u.Role != null ? u.Role.Code : "sales_executive",
                Status = u.Status,
                LastLoginAt = u.LastLoginAt,
                AvatarUrl = u.AvatarUrl,
                CreatedAt = u.CreatedAt,
                IsCovered = _context.WorkHandovers.Any(wh => wh.OriginalUserId == u.Id && wh.Status == "active")
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

        var passwordToHash = !string.IsNullOrWhiteSpace(request.Password) ? request.Password : "Password@123";

        var newUser = new User
        {
            Name = request.Name.Trim(),
            Email = request.Email.Trim().ToLower(),
            Phone = request.Phone?.Trim() ?? string.Empty,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(passwordToHash),
            RoleId = request.RoleId,
            CompanyId = companyId,
            Status = request.Status,
            CreatedAt = DateTime.UtcNow
        };

        _context.Users.Add(newUser);
        await _context.SaveChangesAsync(cancellationToken);

        bool emailSent = request.Status != backend.Models.Enums.UserStatus.Invited;
        string? emailError = null;

        if (request.Status == backend.Models.Enums.UserStatus.Invited)
        {
            try
            {
                var loginUrl = "http://localhost:5173/auth/login";
                var emailBody = $@"
                    <h3>Welcome to GHL India Ventures, {request.Name}!</h3>
                    <p>You have been invited to join the platform as a <b>{role.Name}</b>.</p>
                    <p>Your temporary password is: <strong>{passwordToHash}</strong></p>
                    <p>Please login at <a href='{loginUrl}'>{loginUrl}</a> and change your password.</p>";
                    
                await _emailService.SendEmailAsync(request.Email, "Invitation to GHL India Ventures", emailBody);
                emailSent = true;
            }
            catch (Exception ex)
            {
                emailError = ex.Message.Contains("Daily user sending limit exceeded")
                    ? "Gmail daily sending limit exceeded for the sender email account."
                    : ex.Message;
                Console.WriteLine($"[AdminUserService] Warning: Email dispatch failed for {request.Email}: {ex.Message}");
            }
        }

        var dto = new AdminUserDto
        {
            Id = newUser.Id,
            Name = newUser.Name,
            Email = newUser.Email,
            Phone = newUser.Phone,
            RoleId = newUser.RoleId,
            RoleName = role.Name,
            RoleCode = role.Code,
            Status = newUser.Status,
            CreatedAt = newUser.CreatedAt,
            EmailSent = emailSent,
            EmailError = emailError,
            TemporaryPassword = passwordToHash
        };

        var message = emailSent
            ? "User created successfully and invitation email sent."
            : $"User created successfully. (Notice: Email delivery failed: {emailError})";

        return ApiResponse<AdminUserDto>.SuccessResult(dto, message);
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
        if (!string.IsNullOrWhiteSpace(request.Password))
        {
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
        }
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
            RoleCode = user.Role.Code,
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
                .Include(u => u.Role)
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
                f.AssignedToName = newUser.Name;
                f.AssignedToRole = newUser.Role?.Code ?? "sales_executive";
                f.UpdatedAt = DateTime.UtcNow;
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
                RoleName = oldUser.Role.Name,
                RoleCode = oldUser.Role.Code
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

        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            // 1. Reassign customers to active company admin/agent
            var fallbackUser = await _context.Users
                .Where(u => u.CompanyId == companyId && u.Id != userId && u.Status == backend.Models.Enums.UserStatus.Active)
                .OrderBy(u => u.RoleId == 2 ? 0 : 1) // Prefer Company Admin
                .FirstOrDefaultAsync(cancellationToken);

            var customers = await _context.Customers
                .Where(c => c.CompanyId == companyId && c.AssignedAgentId == userId)
                .ToListAsync(cancellationToken);
            if (fallbackUser != null)
            {
                foreach (var c in customers)
                {
                    c.AssignedAgentId = fallbackUser.Id;
                }
            }

            // 2. Unlink assigned leads
            var leads = await _context.Leads
                .Where(l => l.CompanyId == companyId && l.AssignedAgentId == userId)
                .ToListAsync(cancellationToken);
            foreach (var l in leads)
            {
                l.AssignedAgentId = null;
            }

            // 3. Remove pending followups for this user
            var followups = await _context.Followups
                .Where(f => f.CompanyId == companyId && f.AssignedAgentId == userId)
                .ToListAsync(cancellationToken);
            _context.Followups.RemoveRange(followups);

            // 4. Clean up lead assignment history references
            var historyRecords = await _context.LeadAssignmentHistories
                .Where(h => h.FromAgentId == userId || h.ToAgentId == userId || h.AssignedById == userId)
                .ToListAsync(cancellationToken);
            _context.LeadAssignmentHistories.RemoveRange(historyRecords);

            // 5. Remove user
            _context.Users.Remove(user);

            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return ApiResponse<bool>.SuccessResult(true, "User deleted successfully.");
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiResponse<bool>.FailureResult($"Failed to delete user: {ex.Message}");
        }
    }
}
