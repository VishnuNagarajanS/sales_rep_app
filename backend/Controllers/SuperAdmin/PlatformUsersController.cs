using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.SuperAdmin;
using backend.Models.Entities;
using backend.Models.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers.SuperAdmin;

[ApiController]
[Authorize(Roles = "super_admin")]
[Route("api/super-admin/users")]
[Route("api/platform/users")]
public class PlatformUsersController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public PlatformUsersController(ApplicationDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Returns all users across all tenants, including Super Admins, filtered by optional parameters.
    /// Never excludes Super Admins unless specifically requested.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<PlatformUserDto>>>> GetAllUsers(
        [FromQuery] string? companyId,
        [FromQuery] string? roleCode,
        [FromQuery] string? status,
        [FromQuery] string? search)
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
                (u.Company != null && u.Company.Name.ToLower().Contains(s)));
        }

        var users = await query.OrderBy(u => u.Id).ToListAsync();

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
            LastLogin = u.LastLoginAt.HasValue ? u.LastLoginAt.Value.ToString("yyyy-MM-dd HH:mm:ss") : "Just now",
            Avatar = u.AvatarUrl,
            CreatedAt = u.CreatedAt.ToString("o"),
            UpdatedAt = u.UpdatedAt?.ToString("o")
        }).ToList();

        return Ok(ApiResponse<List<PlatformUserDto>>.SuccessResult(result));
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
            LastLogin = u.LastLoginAt.HasValue ? u.LastLoginAt.Value.ToString("yyyy-MM-dd HH:mm:ss") : "Just now",
            Avatar = u.AvatarUrl,
            CreatedAt = u.CreatedAt.ToString("o"),
            UpdatedAt = u.UpdatedAt?.ToString("o")
        };

        return Ok(ApiResponse<PlatformUserDto>.SuccessResult(dto));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<PlatformUserDto>>> CreateUser([FromBody] CreatePlatformUserDto req)
    {
        if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Name))
            return BadRequest(ApiResponse<PlatformUserDto>.FailureResult("Name and Email are required."));

        var normalizedEmail = req.Email.Trim().ToLowerInvariant();
        var existing = await _context.Users.AnyAsync(u => u.Email.ToLower() == normalizedEmail);
        if (existing)
            return BadRequest(ApiResponse<PlatformUserDto>.FailureResult($"User with email '{req.Email}' already exists."));

        var role = await _context.Roles.FirstOrDefaultAsync(r => r.Code == req.RoleCode);
        if (role == null)
            return BadRequest(ApiResponse<PlatformUserDto>.FailureResult($"Role '{req.RoleCode}' is invalid."));

        int? companyId = null;
        if (!string.IsNullOrWhiteSpace(req.CompanyId) && !req.CompanyId.Equals("global", StringComparison.OrdinalIgnoreCase))
        {
            if (int.TryParse(req.CompanyId, out var cid))
                companyId = cid;
        }

        var password = string.IsNullOrWhiteSpace(req.Password) ? "Password@123" : req.Password;
        var passwordHash = BCrypt.Net.BCrypt.HashPassword(password);

        var newUser = new User
        {
            Name = req.Name.Trim(),
            Email = normalizedEmail,
            PasswordHash = passwordHash,
            Phone = req.Phone?.Trim() ?? string.Empty,
            RoleId = role.Id,
            CompanyId = companyId,
            Status = Enum.TryParse<UserStatus>(req.Status, true, out var st) ? st : UserStatus.Active,
            CreatedAt = DateTime.UtcNow
        };

        _context.Users.Add(newUser);
        await _context.SaveChangesAsync();

        await _context.Entry(newUser).Reference(u => u.Role).LoadAsync();
        if (newUser.CompanyId.HasValue)
            await _context.Entry(newUser).Reference(u => u.Company).LoadAsync();

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
            CompanyId = newUser.CompanyId.HasValue ? newUser.CompanyId.Value.ToString() : null,
            CompanySlug = newUser.Company?.Slug,
            CompanyName = newUser.Company?.Name,
            Status = newUser.Status.ToString(),
            LastLogin = "Never",
            CreatedAt = newUser.CreatedAt.ToString("o")
        };

        return CreatedAtAction(nameof(GetUserById), new { id = newUser.Id }, ApiResponse<PlatformUserDto>.SuccessResult(dto, "User created successfully."));
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
            user.Status = st;
        }

        user.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        var dto = new PlatformUserDto
        {
            Id = user.Id.ToString(),
            Name = user.Name,
            Email = user.Email,
            Phone = user.Phone,
            Role = new PlatformRoleDto
            {
                Id = user.Role.Id.ToString(),
                Name = user.Role.Name,
                Code = user.Role.Code,
                Permissions = user.Role.Permissions ?? new List<string>()
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

        if (user.Email.Equals("yanosh@ghlindiaventures.com", StringComparison.OrdinalIgnoreCase))
            return BadRequest(ApiResponse<bool>.FailureResult("Root Super Admin cannot be deleted."));

        _context.Users.Remove(user);
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<bool>.SuccessResult(true, "User deleted successfully."));
    }

    [HttpPost("{id}/reset-password")]
    public async Task<ActionResult<ApiResponse<object>>> ResetPassword(int id)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null)
            return NotFound(ApiResponse<object>.FailureResult($"User with ID {id} not found."));

        var tempPassword = $"Nexus#{new Random().Next(1000, 9999)}!";
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(tempPassword);
        user.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<object>.SuccessResult(new { tempPassword }, "Temporary password generated successfully."));
    }

    [HttpGet("~/api/super-admin/metrics")]
    [HttpGet("~/api/platform/metrics")]
    public async Task<ActionResult<ApiResponse<PlatformMetricsDto>>> GetPlatformMetrics(
        [FromQuery] string? timeZone = null,
        CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var currentMonthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var nextMonthStart = currentMonthStart.AddMonths(1);
        var prevMonthStart = currentMonthStart.AddMonths(-1);

        var totalTenants = await _context.Tenants.CountAsync(ct);
        var activeTenants = await _context.Tenants.CountAsync(t => t.IsActive && t.Status != "Suspended", ct);
        var onboardingTenants = await _context.Tenants.CountAsync(t => !t.IsActive && t.Status != "Suspended", ct);
        var suspendedTenants = await _context.Tenants.CountAsync(t => t.Status == "Suspended", ct);

        var totalUsers = await _context.Users.CountAsync(ct);
        var activeUsers = await _context.Users.CountAsync(u => u.Status == UserStatus.Active, ct);

        var (callsToday, callsConnected) = await CalculateCallsTodayAsync(timeZone, ct);

        var totalLeads = await _context.Leads.CountAsync(ct);
        var currentMonthLeads = await _context.Leads.CountAsync(l => l.CreatedAt >= currentMonthStart && l.CreatedAt < nextMonthStart, ct);
        var previousMonthLeads = await _context.Leads.CountAsync(l => l.CreatedAt >= prevMonthStart && l.CreatedAt < currentMonthStart, ct);

        var totalCustomers = await _context.Customers.CountAsync(ct);
        var dealSum = await _context.GhlDeals.SumAsync(d => (long)d.Value, ct);

        var metrics = new PlatformMetricsDto
        {
            TotalTenants = totalTenants,
            ActiveTenants = activeTenants,
            OnboardingTenants = onboardingTenants,
            SuspendedTenants = suspendedTenants,
            TotalUsers = totalUsers,
            ActiveUsers = activeUsers,
            CallsToday = callsToday,
            CallsConnected = callsConnected,
            TotalLeads = totalLeads,
            CurrentMonthLeads = currentMonthLeads,
            PreviousMonthLeads = previousMonthLeads,
            TotalPipelineValue = dealSum,
            TotalCustomers = totalCustomers,
            SystemHealthScore = 100.0
        };

        return Ok(ApiResponse<PlatformMetricsDto>.SuccessResult(metrics));
    }

    [HttpGet("~/api/super-admin/metrics/calls-today")]
    [HttpGet("~/api/platform/metrics/calls-today")]
    public async Task<ActionResult<ApiResponse<CallsTodayMetricsDto>>> GetCallsTodayMetrics(
        [FromQuery] string? timeZone = null,
        CancellationToken ct = default)
    {
        var (callsToday, callsConnected) = await CalculateCallsTodayAsync(timeZone, ct);

        var result = new CallsTodayMetricsDto
        {
            CallsToday = callsToday,
            CallsConnected = callsConnected
        };

        return Ok(ApiResponse<CallsTodayMetricsDto>.SuccessResult(result));
    }

    private static (DateTime UtcStart, DateTime UtcEnd) GetTodayUtcRange(string? timeZoneId)
    {
        TimeZoneInfo tz;
        if (!string.IsNullOrWhiteSpace(timeZoneId))
        {
            var cleanId = timeZoneId.Split('(')[0].Trim();
            if (!TimeZoneInfo.TryFindSystemTimeZoneById(cleanId, out tz!) &&
                !TimeZoneInfo.TryFindSystemTimeZoneById(timeZoneId.Trim(), out tz!))
            {
                if (cleanId.Equals("Asia/Kolkata", StringComparison.OrdinalIgnoreCase) ||
                    cleanId.Equals("IST", StringComparison.OrdinalIgnoreCase) ||
                    cleanId.Equals("Asia/Calcutta", StringComparison.OrdinalIgnoreCase))
                {
                    if (!TimeZoneInfo.TryFindSystemTimeZoneById("India Standard Time", out tz!))
                    {
                        tz = TimeZoneInfo.CreateCustomTimeZone("IST", TimeSpan.FromHours(5.5), "India Standard Time", "India Standard Time");
                    }
                }
                else
                {
                    if (!TimeZoneInfo.TryFindSystemTimeZoneById("India Standard Time", out tz!) &&
                        !TimeZoneInfo.TryFindSystemTimeZoneById("Asia/Kolkata", out tz!))
                    {
                        tz = TimeZoneInfo.CreateCustomTimeZone("IST", TimeSpan.FromHours(5.5), "India Standard Time", "India Standard Time");
                    }
                }
            }
        }
        else
        {
            if (!TimeZoneInfo.TryFindSystemTimeZoneById("Asia/Kolkata", out tz!) &&
                !TimeZoneInfo.TryFindSystemTimeZoneById("India Standard Time", out tz!))
            {
                tz = TimeZoneInfo.CreateCustomTimeZone("IST", TimeSpan.FromHours(5.5), "India Standard Time", "India Standard Time");
            }
        }

        var localNow = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
        var localTodayStart = localNow.Date;
        var localTomorrowStart = localTodayStart.AddDays(1);

        var utcStart = TimeZoneInfo.ConvertTimeToUtc(localTodayStart, tz);
        var utcEnd = TimeZoneInfo.ConvertTimeToUtc(localTomorrowStart, tz);

        return (utcStart, utcEnd);
    }

    private async Task<(int CallsToday, int CallsConnected)> CalculateCallsTodayAsync(string? timeZone, CancellationToken ct)
    {
        var (utcStart, utcEnd) = GetTodayUtcRange(timeZone);

        var callsToday = await _context.CallRecords
            .CountAsync(c => c.Timestamp >= utcStart && c.Timestamp < utcEnd, ct);

        var nonConnectedDispositions = new[] { "Failed", "No Answer", "No Response", "Missed", "Busy" };

        var callsConnected = await _context.CallRecords
            .CountAsync(c => c.Timestamp >= utcStart && c.Timestamp < utcEnd
                && !nonConnectedDispositions.Contains(c.Disposition)
                && (c.Duration > 0 || (c.Disposition != null && c.Disposition != "")), ct);

        return (callsToday, callsConnected);
    }
}
