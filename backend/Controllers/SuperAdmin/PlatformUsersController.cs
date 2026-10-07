using backend.Authentication.Interfaces;
using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.SuperAdmin;
using backend.Hubs;
using backend.Models.Entities;
using backend.Models.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers.SuperAdmin;

[ApiController]
[Authorize(Roles = "super_admin")]
[Route("api/super-admin/users")]
[Route("api/platform/users")]
public class PlatformUsersController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;
    private readonly IHubContext<PlatformHub, IPlatformHubClient> _hubContext;

    public PlatformUsersController(
        ApplicationDbContext context,
        ICurrentUserService currentUser,
        IHubContext<PlatformHub, IPlatformHubClient> hubContext)
    {
        _context = context;
        _currentUser = currentUser;
        _hubContext = hubContext;
    }

    /// <summary>
    /// Returns paginated users across all tenants, including Super Admins, filtered by optional parameters.
    /// Never excludes Super Admins unless specifically requested.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResult<PlatformUserDto>>>> GetAllUsers(
        [FromQuery] string? companyId,
        [FromQuery] string? roleCode,
        [FromQuery] string? status,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        [FromQuery] string? sortBy = "id",
        [FromQuery] string? sortDir = "asc")
    {
        var query = _context.Users
            .Include(u => u.Role)
            .Include(u => u.Company)
            .AsNoTracking();

        // 1. Organization / Company filter
        if (!string.IsNullOrWhiteSpace(companyId) && !companyId.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            if (companyId.Equals("global", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(u => u.CompanyId == null);
            }
            else if (int.TryParse(companyId, out var cid))
            {
                query = query.Where(u => u.CompanyId == cid);
            }
            else
            {
                var s = companyId.Trim().ToLower();
                if (s == "ghl" || s == "t-ghl-01")
                {
                    query = query.Where(u => u.CompanyId == 1 || (u.Company != null && u.Company.Slug.ToLower() == "ghl"));
                }
                else if (s == "jamin" || s == "t-jamin-02")
                {
                    query = query.Where(u => u.CompanyId == 2 || (u.Company != null && u.Company.Slug.ToLower() == "jamin"));
                }
                else
                {
                    query = query.Where(u => u.Company != null && (u.Company.Slug.ToLower() == s || u.Company.Name.ToLower() == s));
                }
            }
        }

        // 2. Role filter
        if (!string.IsNullOrWhiteSpace(roleCode) && !roleCode.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(u => u.Role.Code == roleCode);
        }

        // 3. Status filter
        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            if (Enum.TryParse<UserStatus>(status, true, out var parsedStatus))
            {
                query = query.Where(u => u.Status == parsedStatus);
            }
        }

        // 4. Text search
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(u =>
                u.Name.ToLower().Contains(s) ||
                u.Email.ToLower().Contains(s) ||
                u.Phone.ToLower().Contains(s) ||
                (u.Company != null && (u.Company.Name.ToLower().Contains(s) || u.Company.Slug.ToLower().Contains(s))));
        }

        var totalCount = await query.CountAsync();

        // 5. Sorting
        var isDesc = sortDir?.Equals("desc", StringComparison.OrdinalIgnoreCase) ?? false;
        query = (sortBy?.ToLower()) switch
        {
            "name" => isDesc ? query.OrderByDescending(u => u.Name) : query.OrderBy(u => u.Name),
            "email" => isDesc ? query.OrderByDescending(u => u.Email) : query.OrderBy(u => u.Email),
            "role" => isDesc ? query.OrderByDescending(u => u.Role.Name) : query.OrderBy(u => u.Role.Name),
            "company" => isDesc ? query.OrderByDescending(u => u.Company != null ? u.Company.Name : "") : query.OrderBy(u => u.Company != null ? u.Company.Name : ""),
            "status" => isDesc ? query.OrderByDescending(u => u.Status) : query.OrderBy(u => u.Status),
            "lastlogin" => isDesc ? query.OrderByDescending(u => u.LastLoginAt) : query.OrderBy(u => u.LastLoginAt),
            _ => isDesc ? query.OrderByDescending(u => u.Id) : query.OrderBy(u => u.Id)
        };

        // 6. Pagination
        var safePage = page < 1 ? 1 : page;
        var safePageSize = pageSize < 1 ? 25 : (pageSize > 200 ? 200 : pageSize);

        var users = await query
            .Skip((safePage - 1) * safePageSize)
            .Take(safePageSize)
            .ToListAsync();

        var result = users.Select(u => new PlatformUserDto
        {
            Id = u.Id.ToString(),
            Name = u.Name,
            Email = u.Email,
            Phone = u.Phone,
            Role = new PlatformRoleDto
            {
                Id = u.Role.Id.ToString(),
                Name = u.Role.Name,
                Code = u.Role.Code,
                Permissions = u.Role.Permissions ?? new List<string>()
            },
            CompanyId = u.CompanyId.HasValue ? u.CompanyId.Value.ToString() : null,
            CompanySlug = u.Company?.Slug,
            CompanyName = u.Company?.Name,
            Status = u.Status.ToString(),
            LastLogin = u.LastLoginAt.HasValue ? u.LastLoginAt.Value.ToString("yyyy-MM-dd HH:mm:ss") : "Never",
            Avatar = u.AvatarUrl,
            Designation = u.Role?.Name ?? "Platform User",
            CreatedAt = u.CreatedAt.ToString("o"),
            UpdatedAt = u.UpdatedAt?.ToString("o")
        }).ToList();

        var pagedResult = PagedResult<PlatformUserDto>.Create(result, totalCount, safePage, safePageSize);
        return Ok(ApiResponse<PagedResult<PlatformUserDto>>.SuccessResult(pagedResult));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<PlatformUserDto>>> GetUserById(int id)
    {
        var u = await _context.Users
            .Include(u => u.Role)
            .Include(u => u.Company)
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == id);

        if (u == null)
            return NotFound(ApiResponse<PlatformUserDto>.FailureResult($"User with ID {id} not found."));

        var dto = new PlatformUserDto
        {
            Id = u.Id.ToString(),
            Name = u.Name,
            Email = u.Email,
            Phone = u.Phone,
            Role = new PlatformRoleDto
            {
                Id = u.Role.Id.ToString(),
                Name = u.Role.Name,
                Code = u.Role.Code,
                Permissions = u.Role.Permissions ?? new List<string>()
            },
            CompanyId = u.CompanyId.HasValue ? u.CompanyId.Value.ToString() : null,
            CompanySlug = u.Company?.Slug,
            CompanyName = u.Company?.Name,
            Status = u.Status.ToString(),
            LastLogin = u.LastLoginAt.HasValue ? u.LastLoginAt.Value.ToString("yyyy-MM-dd HH:mm:ss") : "Never",
            Avatar = u.AvatarUrl,
            Designation = u.Role?.Name ?? "Platform User",
            CreatedAt = u.CreatedAt.ToString("o"),
            UpdatedAt = u.UpdatedAt?.ToString("o")
        };

        return Ok(ApiResponse<PlatformUserDto>.SuccessResult(dto));
    }

    /// <summary>
    /// Super Admin user provisioning: can create ONLY Company Admins.
    /// Other operational roles (Sales Executive, IRM, etc.) must be created by their respective Company Admin.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<ApiResponse<PlatformUserDto>>> CreateUser([FromBody] CreatePlatformUserDto req)
    {
        if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Name))
            return BadRequest(ApiResponse<PlatformUserDto>.FailureResult("Name and Email are required."));

        // MANDATORY ENFORCEMENT: Super Admin can create ONLY Company Admins
        var requestedRole = req.RoleCode?.Trim().ToLowerInvariant();
        if (requestedRole != "company_admin")
        {
            return BadRequest(ApiResponse<PlatformUserDto>.FailureResult(
                "Super Admin is authorized to create Company Admin users only. Other roles (Sales Executive, IRM, etc.) must be created by their respective Company Admin."));
        }

        // Validate Tenant Organization: Company Admin must belong to a valid tenant organization
        if (string.IsNullOrWhiteSpace(req.CompanyId) || req.CompanyId.Equals("global", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(ApiResponse<PlatformUserDto>.FailureResult(
                "A valid Tenant Organization must be assigned for Company Admin creation."));
        }

        int companyId;
        if (int.TryParse(req.CompanyId, out var cid))
        {
            var tenantExists = await _context.Tenants.AnyAsync(t => t.Id == cid);
            if (!tenantExists)
                return BadRequest(ApiResponse<PlatformUserDto>.FailureResult($"Tenant organization with ID {cid} not found."));
            companyId = cid;
        }
        else
        {
            var tenant = await _context.Tenants.FirstOrDefaultAsync(t => t.Slug.ToLower() == req.CompanyId.Trim().ToLower());
            if (tenant == null)
                return BadRequest(ApiResponse<PlatformUserDto>.FailureResult($"Tenant organization '{req.CompanyId}' not found."));
            companyId = tenant.Id;
        }

        var normalizedEmail = req.Email.Trim().ToLowerInvariant();
        var existing = await _context.Users.AnyAsync(u => u.Email.ToLower() == normalizedEmail);
        if (existing)
            return BadRequest(ApiResponse<PlatformUserDto>.FailureResult($"User with email '{req.Email}' already exists."));

        var role = await _context.Roles.FirstOrDefaultAsync(r => r.Code == "company_admin");
        if (role == null)
            return BadRequest(ApiResponse<PlatformUserDto>.FailureResult("Role 'company_admin' is not configured in database."));

        var isGeneratedTemp = string.IsNullOrWhiteSpace(req.Password);
        var tempPassword = isGeneratedTemp
            ? backend.Helpers.PasswordHasher.GenerateTemporaryPassword()
            : req.Password!.Trim();
        var passwordHash = backend.Helpers.PasswordHasher.HashPassword(tempPassword);

        var newUser = new User
        {
            Name = req.Name.Trim(),
            Email = normalizedEmail,
            PasswordHash = passwordHash,
            Phone = req.Phone?.Trim() ?? string.Empty,
            RoleId = role.Id,
            CompanyId = companyId,
            Status = Enum.TryParse<UserStatus>(req.Status, true, out var st) ? st : UserStatus.Active,
            MustChangePassword = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.Users.Add(newUser);
        await _context.SaveChangesAsync();

        await _context.Entry(newUser).Reference(u => u.Role).LoadAsync();
        await _context.Entry(newUser).Reference(u => u.Company).LoadAsync();

        _context.AuditLogs.Add(new AuditLog
        {
            Action = "CREATE_COMPANY_ADMIN",
            EntityType = "User",
            EntityId = newUser.Id.ToString(),
            ActorName = _currentUser.Email ?? "Super Admin",
            ActorEmail = _currentUser.Email ?? "admin@platform.com",
            Details = $"Super Admin provisioned Company Admin '{newUser.Name}' ({newUser.Email}) for organization '{newUser.Company?.Name}' (ID: {companyId}).",
            Module = "Users",
            Status = "success",
            Timestamp = DateTime.UtcNow
        });
        await _context.SaveChangesAsync();

        try
        {
            await _hubContext.Clients.All.PlatformDataUpdated("User", "Created");
        }
        catch { }

        var dto = new PlatformUserDto
        {
            Id = newUser.Id.ToString(),
            Name = newUser.Name,
            Email = newUser.Email,
            Phone = newUser.Phone,
            Role = new PlatformRoleDto
            {
                Id = newUser.Role.Id.ToString(),
                Name = newUser.Role.Name,
                Code = newUser.Role.Code,
                Permissions = newUser.Role.Permissions ?? new List<string>()
            },
            CompanyId = newUser.CompanyId.ToString(),
            CompanySlug = newUser.Company?.Slug,
            CompanyName = newUser.Company?.Name,
            Status = newUser.Status.ToString(),
            LastLogin = "Never",
            Avatar = newUser.AvatarUrl,
            EmployeeCode = req.EmployeeCode,
            Designation = req.Designation ?? newUser.Role?.Name ?? "Company Administrator",
            MustChangePassword = newUser.MustChangePassword,
            TemporaryPassword = tempPassword,
            CreatedAt = newUser.CreatedAt.ToString("o")
        };

        return CreatedAtAction(nameof(GetUserById), new { id = newUser.Id }, ApiResponse<PlatformUserDto>.SuccessResult(dto, "Company Admin provisioned successfully."));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<ApiResponse<PlatformUserDto>>> UpdateUser(int id, [FromBody] UpdatePlatformUserDto req)
    {
        var user = await _context.Users
            .Include(u => u.Role)
            .Include(u => u.Company)
            .FirstOrDefaultAsync(u => u.Id == id);

        if (user == null)
            return NotFound(ApiResponse<PlatformUserDto>.FailureResult($"User with ID {id} not found."));

        if (!string.IsNullOrWhiteSpace(req.Name))
            user.Name = req.Name.Trim();

        if (!string.IsNullOrWhiteSpace(req.Email))
            user.Email = req.Email.Trim().ToLowerInvariant();

        if (req.Phone != null)
            user.Phone = req.Phone.Trim();

        if (!string.IsNullOrWhiteSpace(req.RoleCode))
        {
            var role = await _context.Roles.FirstOrDefaultAsync(r => r.Code == req.RoleCode);
            if (role != null)
            {
                user.RoleId = role.Id;
                user.Role = role;
            }
        }

        if (req.CompanyId != null)
        {
            if (req.CompanyId.Equals("global", StringComparison.OrdinalIgnoreCase) || string.IsNullOrWhiteSpace(req.CompanyId))
            {
                user.CompanyId = null;
                user.Company = null;
            }
            else if (int.TryParse(req.CompanyId, out var cid))
            {
                user.CompanyId = cid;
            }
        }

        if (!string.IsNullOrWhiteSpace(req.Status) && Enum.TryParse<UserStatus>(req.Status, true, out var st))
        {
            if (user.IsProtected && st == UserStatus.Disabled)
            {
                return BadRequest(ApiResponse<PlatformUserDto>.FailureResult(
                    $"User '{user.Name}' is a protected system administrator and cannot be deactivated or disabled."));
            }

            var previousStatus = user.Status;
            user.Status = st;

            if (st == UserStatus.Disabled)
            {
                var sessions = await _context.UserSessions.Where(s => s.UserId == user.Id && s.IsActive).ToListAsync();
                foreach (var s in sessions)
                {
                    s.IsActive = false;
                    s.RevokedAt = DateTime.UtcNow;
                    s.RevokedReason = "User account was suspended or disabled by Super Admin.";
                }

                try
                {
                    await _hubContext.Clients.Group($"user_{user.Id}").UserSuspended(user.Id, user.Email, "Your account has been suspended by platform administration.");
                }
                catch { }
            }
            else if (previousStatus != UserStatus.Active && st == UserStatus.Active)
            {
                try
                {
                    await _hubContext.Clients.Group($"user_{user.Id}").UserActivated(user.Id, user.Email);
                }
                catch { }
            }
        }

        if (!string.IsNullOrWhiteSpace(req.Password))
        {
            user.PasswordHash = backend.Helpers.PasswordHasher.HashPassword(req.Password.Trim());
            user.MustChangePassword = false;
        }

        user.UpdatedAt = DateTime.UtcNow;

        _context.AuditLogs.Add(new AuditLog
        {
            Action = "UPDATE_USER",
            EntityType = "User",
            EntityId = user.Id.ToString(),
            CompanyId = user.CompanyId,
            ActorName = _currentUser.Email ?? "Super Admin",
            ActorEmail = _currentUser.Email ?? "admin@platform.com",
            Details = $"Super Admin updated user '{user.Name}' ({user.Email}) with role '{user.Role?.Name}' and status '{user.Status}'.",
            Module = "Users",
            Status = "success",
            Timestamp = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();

        try
        {
            await _hubContext.Clients.All.PlatformDataUpdated("User", "Updated");
        }
        catch { }

        var dto = new PlatformUserDto
        {
            Id = user.Id.ToString(),
            Name = user.Name,
            Email = user.Email,
            Phone = user.Phone,
            Role = new PlatformRoleDto
            {
                Id = user.Role?.Id.ToString() ?? "0",
                Name = user.Role?.Name ?? "User",
                Code = user.Role?.Code ?? "user",
                Permissions = user.Role?.Permissions ?? new List<string>()
            },
            CompanyId = user.CompanyId.HasValue ? user.CompanyId.Value.ToString() : null,
            CompanySlug = user.Company?.Slug,
            CompanyName = user.Company?.Name,
            Status = user.Status.ToString(),
            LastLogin = user.LastLoginAt.HasValue ? user.LastLoginAt.Value.ToString("yyyy-MM-dd HH:mm:ss") : "Never",
            CreatedAt = user.CreatedAt.ToString("o"),
            UpdatedAt = user.UpdatedAt?.ToString("o")
        };

        return Ok(ApiResponse<PlatformUserDto>.SuccessResult(dto, "User updated successfully."));
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteUser(int id)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null)
            return NotFound(ApiResponse<bool>.FailureResult($"User with ID {id} not found."));

        if (user.IsProtected)
            return BadRequest(ApiResponse<bool>.FailureResult("Root Super Admin and protected system accounts cannot be deleted."));

        var userName = user.Name;
        var userEmail = user.Email;
        var userCompanyId = user.CompanyId;

        _context.Users.Remove(user);

        _context.AuditLogs.Add(new AuditLog
        {
            Action = "DELETE_USER",
            EntityType = "User",
            EntityId = id.ToString(),
            CompanyId = userCompanyId,
            ActorName = _currentUser.Email ?? "Super Admin",
            ActorEmail = _currentUser.Email ?? "admin@platform.com",
            Details = $"Super Admin permanently deleted user account '{userName}' ({userEmail}).",
            Module = "Users",
            Status = "success",
            Timestamp = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();

        try
        {
            await _hubContext.Clients.All.PlatformDataUpdated("User", "Deleted");
        }
        catch { }

        return Ok(ApiResponse<bool>.SuccessResult(true, "User deleted successfully."));
    }

    [HttpPost("{id}/reset-password")]
    public async Task<ActionResult<ApiResponse<object>>> ResetPassword(int id, [FromBody] AdminResetPasswordRequestDto? req = null)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null)
            return NotFound(ApiResponse<object>.FailureResult($"User with ID {id} not found."));

        var tempPassword = !string.IsNullOrWhiteSpace(req?.NewPassword)
            ? req.NewPassword.Trim()
            : backend.Helpers.PasswordHasher.GenerateTemporaryPassword();
        user.PasswordHash = backend.Helpers.PasswordHasher.HashPassword(tempPassword);
        user.MustChangePassword = true;
        user.UpdatedAt = DateTime.UtcNow;

        // Invalidate active sessions for this user
        var sessions = await _context.UserSessions.Where(s => s.UserId == user.Id && s.IsActive).ToListAsync();
        foreach (var s in sessions)
        {
            s.IsActive = false;
            s.RevokedAt = DateTime.UtcNow;
            s.RevokedReason = "Administrator reset account credentials.";
        }

        _context.AuditLogs.Add(new AuditLog
        {
            Action = "RESET_PASSWORD",
            EntityType = "User",
            EntityId = user.Id.ToString(),
            CompanyId = user.CompanyId,
            ActorName = _currentUser.Email ?? "Super Admin",
            ActorEmail = _currentUser.Email ?? "admin@platform.com",
            Details = $"Super Admin generated temporary credentials for user '{user.Name}' ({user.Email}). Active sessions revoked.",
            Module = "Users",
            Status = "success",
            Timestamp = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();

        try
        {
            await _hubContext.Clients.Group($"user_{user.Id}").SessionRevoked("ALL", user.Id);
        }
        catch { }

        return Ok(ApiResponse<object>.SuccessResult(new { tempPassword }, "Temporary password generated successfully."));
    }

    [HttpGet("~/api/super-admin/metrics")]
    [HttpGet("~/api/platform/metrics")]
    public async Task<ActionResult<ApiResponse<PlatformMetricsDto>>> GetPlatformMetrics(
        [FromQuery] string? timeZone = null,
        CancellationToken ct = default)
    {
        var (currentMonthStart, nextMonthStart, prevMonthStart) = GetMonthUtcRanges(timeZone);

        var totalTenants = await _context.Tenants.CountAsync(ct);
        var activeTenants = await _context.Tenants.CountAsync(t => t.IsActive && t.Status != "Suspended", ct);
        var onboardingTenants = await _context.Tenants.CountAsync(t => !t.IsActive && t.Status != "Suspended", ct);
        var suspendedTenants = await _context.Tenants.CountAsync(t => t.Status == "Suspended", ct);

        var totalUsers = await _context.Users.CountAsync(ct);
        var activeUsers = await _context.Users.CountAsync(u => u.Status == UserStatus.Active, ct);

        // Real role distribution counts from database
        var superAdminCount = await _context.Users.CountAsync(u => u.RoleId == 1, ct);
        var companyAdminCount = await _context.Users.CountAsync(u => u.RoleId == 2, ct);
        var salesExecCount = await _context.Users.CountAsync(u => u.RoleId == 3, ct);
        var irmCount = await _context.Users.CountAsync(u => u.RoleId == 4, ct);

        var totalCalls = await _context.CallRecords.CountAsync(ct);
        var (callsToday, callsConnected, callsFailed, callDuration, callSuccessRate) = await CalculateCallsTodayAsync(timeZone, ct);

        var totalLeads = await _context.Leads.CountAsync(ct);
        var currentMonthLeads = await _context.Leads.CountAsync(l => l.CreatedAt >= currentMonthStart && l.CreatedAt < nextMonthStart, ct);
        var previousMonthLeads = await _context.Leads.CountAsync(l => l.CreatedAt >= prevMonthStart && l.CreatedAt < currentMonthStart, ct);

        var totalCustomers = await _context.Customers.CountAsync(ct);
        var ghlDealSum = await _context.GhlDeals.SumAsync(d => d.Value, ct);
        var irmDealSum = 0m;
        var totalPipelineValue = (long)Math.Round(ghlDealSum + irmDealSum);

        // Real system health score from persistent uptime telemetry
        double systemHealthScore = 100.0;
        try
        {
            var telemetry = await _context.PlatformSettings
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.Key == "system_uptime_telemetry", ct);
            if (telemetry != null && !string.IsNullOrWhiteSpace(telemetry.Value))
            {
                using var doc = System.Text.Json.JsonDocument.Parse(telemetry.Value);
                if (doc.RootElement.TryGetProperty("TotalChecks", out var tc) && doc.RootElement.TryGetProperty("SuccessfulChecks", out var sc))
                {
                    var total = tc.GetInt32();
                    var succ = sc.GetInt32();
                    if (total > 0)
                    {
                        systemHealthScore = Math.Round(((double)succ / total) * 100.0, 1);
                    }
                }
            }
        }
        catch { }

        var metrics = new PlatformMetricsDto
        {
            TotalTenants = totalTenants,
            ActiveTenants = activeTenants,
            OnboardingTenants = onboardingTenants,
            SuspendedTenants = suspendedTenants,
            TotalUsers = totalUsers,
            ActiveUsers = activeUsers,
            SuperAdminCount = superAdminCount,
            CompanyAdminCount = companyAdminCount,
            SalesExecutiveCount = salesExecCount,
            IrmCount = irmCount,
            TotalCalls = totalCalls,
            CallsToday = callsToday,
            CallsConnected = callsConnected,
            CallsFailed = callsFailed,
            CallsDurationToday = callDuration,
            CallSuccessRate = callSuccessRate,
            TotalLeads = totalLeads,
            CurrentMonthLeads = currentMonthLeads,
            PreviousMonthLeads = previousMonthLeads,
            TotalPipelineValue = totalPipelineValue,
            TotalCustomers = totalCustomers,
            SystemHealthScore = systemHealthScore
        };

        return Ok(ApiResponse<PlatformMetricsDto>.SuccessResult(metrics));
    }

    [HttpGet("~/api/super-admin/metrics/calls-today")]
    [HttpGet("~/api/platform/metrics/calls-today")]
    public async Task<ActionResult<ApiResponse<CallsTodayMetricsDto>>> GetCallsTodayMetrics(
        [FromQuery] string? timeZone = null,
        CancellationToken ct = default)
    {
        var (callsToday, callsConnected, callsFailed, duration, successRate) = await CalculateCallsTodayAsync(timeZone, ct);

        var result = new CallsTodayMetricsDto
        {
            CallsToday = callsToday,
            CallsConnected = callsConnected,
            CallsFailed = callsFailed,
            TotalDurationSeconds = duration,
            SuccessRate = successRate
        };

        return Ok(ApiResponse<CallsTodayMetricsDto>.SuccessResult(result));
    }

    private static TimeZoneInfo ResolveTimeZone(string? timeZoneId)
    {
        TimeZoneInfo tz;
        if (!string.IsNullOrWhiteSpace(timeZoneId))
        {
            var cleanId = timeZoneId.Split('(')[0].Trim();
            if (TimeZoneInfo.TryFindSystemTimeZoneById(cleanId, out tz!) ||
                TimeZoneInfo.TryFindSystemTimeZoneById(timeZoneId.Trim(), out tz!))
            {
                return tz;
            }

            if (cleanId.Equals("Asia/Kolkata", StringComparison.OrdinalIgnoreCase) ||
                cleanId.Equals("IST", StringComparison.OrdinalIgnoreCase) ||
                cleanId.Equals("Asia/Calcutta", StringComparison.OrdinalIgnoreCase))
            {
                if (TimeZoneInfo.TryFindSystemTimeZoneById("India Standard Time", out tz!))
                {
                    return tz;
                }
                return TimeZoneInfo.CreateCustomTimeZone("IST", TimeSpan.FromHours(5.5), "India Standard Time", "India Standard Time");
            }

            if (TimeZoneInfo.TryFindSystemTimeZoneById("India Standard Time", out tz!) ||
                TimeZoneInfo.TryFindSystemTimeZoneById("Asia/Kolkata", out tz!))
            {
                return tz;
            }
            return TimeZoneInfo.CreateCustomTimeZone("IST", TimeSpan.FromHours(5.5), "India Standard Time", "India Standard Time");
        }

        if (TimeZoneInfo.TryFindSystemTimeZoneById("Asia/Kolkata", out tz!) ||
            TimeZoneInfo.TryFindSystemTimeZoneById("India Standard Time", out tz!))
        {
            return tz;
        }
        return TimeZoneInfo.CreateCustomTimeZone("IST", TimeSpan.FromHours(5.5), "India Standard Time", "India Standard Time");
    }

    private static (DateTime UtcStart, DateTime UtcEnd) GetTodayUtcRange(string? timeZoneId)
    {
        var tz = ResolveTimeZone(timeZoneId);
        var localNow = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
        var localTodayStart = localNow.Date;
        var localTomorrowStart = localTodayStart.AddDays(1);

        var utcStart = TimeZoneInfo.ConvertTimeToUtc(localTodayStart, tz);
        var utcEnd = TimeZoneInfo.ConvertTimeToUtc(localTomorrowStart, tz);

        return (utcStart, utcEnd);
    }

    private static (DateTime CurrentMonthStart, DateTime NextMonthStart, DateTime PrevMonthStart) GetMonthUtcRanges(string? timeZoneId)
    {
        var tz = ResolveTimeZone(timeZoneId);
        var localNow = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);

        var localCurrentMonthStart = new DateTime(localNow.Year, localNow.Month, 1, 0, 0, 0, DateTimeKind.Unspecified);
        var localNextMonthStart = localCurrentMonthStart.AddMonths(1);
        var localPrevMonthStart = localCurrentMonthStart.AddMonths(-1);

        var currentMonthStart = TimeZoneInfo.ConvertTimeToUtc(localCurrentMonthStart, tz);
        var nextMonthStart = TimeZoneInfo.ConvertTimeToUtc(localNextMonthStart, tz);
        var prevMonthStart = TimeZoneInfo.ConvertTimeToUtc(localPrevMonthStart, tz);

        return (currentMonthStart, nextMonthStart, prevMonthStart);
    }

    private async Task<(int CallsToday, int CallsConnected, int CallsFailed, int TotalDuration, double SuccessRate)> CalculateCallsTodayAsync(string? timeZone, CancellationToken ct)
    {
        var (utcStart, utcEnd) = GetTodayUtcRange(timeZone);

        var callsToday = await _context.CallRecords
            .CountAsync(c => c.Timestamp >= utcStart && c.Timestamp < utcEnd, ct);

        var nonConnectedDispositions = new[] { "Failed", "No Answer", "No Response", "Missed", "Busy" };

        var callsFailed = await _context.CallRecords
            .CountAsync(c => c.Timestamp >= utcStart && c.Timestamp < utcEnd
                && nonConnectedDispositions.Contains(c.Disposition), ct);

        var callsConnected = await _context.CallRecords
            .CountAsync(c => c.Timestamp >= utcStart && c.Timestamp < utcEnd
                && !nonConnectedDispositions.Contains(c.Disposition)
                && (c.Duration > 0 || (c.Disposition != null && c.Disposition != "")), ct);

        var totalDuration = await _context.CallRecords
            .Where(c => c.Timestamp >= utcStart && c.Timestamp < utcEnd)
            .SumAsync(c => c.Duration, ct);

        var successRate = callsToday > 0 ? Math.Round(((double)callsConnected / callsToday) * 100.0, 1) : 100.0;

        return (callsToday, callsConnected, callsFailed, totalDuration, successRate);
    }
}
