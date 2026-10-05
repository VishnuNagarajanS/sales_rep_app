using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text.Json;
using backend.Authentication.Interfaces;
using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.SuperAdmin;
using backend.Helpers;
using backend.Hubs;
using backend.Models.Entities;
using backend.Models.Enums;
using backend.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers.SuperAdmin;

[ApiController]
[Authorize(Roles = "super_admin")]
[Route("api/super-admin/security")]
[Route("api/platform/security")]
public class PlatformSecurityController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;
    private readonly ITotpService _totpService;
    private readonly IHubContext<PlatformHub, IPlatformHubClient> _hubContext;
    private readonly ILogger<PlatformSecurityController> _logger;

    public PlatformSecurityController(
        ApplicationDbContext context,
        ICurrentUserService currentUser,
        ITotpService totpService,
        IHubContext<PlatformHub, IPlatformHubClient> hubContext,
        ILogger<PlatformSecurityController> logger)
    {
        _context = context;
        _currentUser = currentUser;
        _totpService = totpService;
        _hubContext = hubContext;
        _logger = logger;
    }

    [HttpGet("overview")]
    public async Task<ActionResult<ApiResponse<SecurityOverviewDto>>> GetOverview(CancellationToken ct = default)
    {
        var totalSessions = await _context.UserSessions.CountAsync(ct);
        var activeSessions = await _context.UserSessions.CountAsync(s => s.IsActive, ct);

        var totalUsers = await _context.Users.CountAsync(ct);
        var twoFactorCount = await _context.Users.CountAsync(u => u.IsTwoFactorEnabled, ct);
        var twoFactorRate = totalUsers > 0 ? Math.Round(((double)twoFactorCount / totalUsers) * 100.0, 1) : 0.0;

        var yesterday = DateTime.UtcNow.AddHours(-24);
        var failedLogins24h = await _context.SecurityEvents
            .CountAsync(e => e.EventType == "LOGIN_FAILURE" && e.CreatedAt >= yesterday, ct);

        var totalEvents = await _context.SecurityEvents.CountAsync(ct);

        var recentEvents = await _context.SecurityEvents
            .AsNoTracking()
            .OrderByDescending(e => e.CreatedAt)
            .Take(10)
            .Select(e => new SecurityEventDto
            {
                Id = e.Id,
                EventType = e.EventType,
                Severity = e.Severity,
                Description = e.Details,
                IpAddress = e.IpAddress,
                UserEmail = e.ActorEmail,
                UserId = e.UserId,
                Timestamp = e.CreatedAt,
                Details = e.Details
            })
            .ToListAsync(ct);

        var overview = new SecurityOverviewDto
        {
            TotalSessions = totalSessions,
            ActiveSessions = activeSessions,
            TwoFactorAdoptionCount = twoFactorCount,
            TwoFactorAdoptionRate = twoFactorRate,
            FailedLogins24h = failedLogins24h,
            TotalSecurityEvents = totalEvents,
            RecentSecurityEvents = recentEvents
        };

        return Ok(ApiResponse<SecurityOverviewDto>.SuccessResult(overview));
    }

    [HttpGet("sessions")]
    public async Task<ActionResult<ApiResponse<List<UserSessionDto>>>> GetSessions(
        [FromQuery] int? userId = null,
        [FromQuery] bool activeOnly = true,
        CancellationToken ct = default)
    {
        var currentJti = User.FindFirst(JwtRegisteredClaimNames.Jti)?.Value;

        var query = _context.UserSessions
            .Include(s => s.User)
                .ThenInclude(u => u.Role)
            .AsNoTracking()
            .AsQueryable();

        if (userId.HasValue)
        {
            query = query.Where(s => s.UserId == userId.Value);
        }

        if (activeOnly)
        {
            query = query.Where(s => s.IsActive);
        }

        var sessions = await query
            .OrderByDescending(s => s.LastActivityAt)
            .Take(100)
            .ToListAsync(ct);

        var dtos = sessions.Select(s => new UserSessionDto
        {
            Id = s.Id,
            UserId = s.UserId,
            UserName = s.User?.Name ?? "Unknown",
            UserEmail = s.User?.Email ?? "Unknown",
            RoleCode = s.User?.Role?.Code ?? "unknown",
            TokenId = s.TokenId,
            IpAddress = s.IpAddress,
            UserAgent = s.UserAgent,
            Device = s.Device,
            Location = s.Location,
            IsActive = s.IsActive,
            IsCurrent = !string.IsNullOrEmpty(currentJti) && s.TokenId == currentJti,
            CreatedAt = s.CreatedAt,
            LastActivityAt = s.LastActivityAt,
            RevokedAt = s.RevokedAt,
            RevokedReason = s.RevokedReason
        }).ToList();

        return Ok(ApiResponse<List<UserSessionDto>>.SuccessResult(dtos));
    }

    [HttpPost("sessions/{id}/revoke")]
    public async Task<ActionResult<ApiResponse<bool>>> RevokeSession(int id, CancellationToken ct = default)
    {
        var session = await _context.UserSessions.Include(s => s.User).FirstOrDefaultAsync(s => s.Id == id, ct);
        if (session == null)
        {
            return NotFound(ApiResponse<bool>.FailureResult($"Session with ID {id} not found."));
        }

        session.IsActive = false;
        session.RevokedAt = DateTime.UtcNow;
        session.RevokedReason = "Revoked by Super Admin";

        _context.SecurityEvents.Add(new SecurityEvent
        {
            EventType = "SESSION_REVOKED",
            Severity = "WARNING",
            Description = $"Super Admin revoked session for user {session.User?.Email} (Token ID: {session.TokenId}).",
            IpAddress = session.IpAddress,
            UserEmail = session.User?.Email,
            UserId = session.UserId,
            Timestamp = DateTime.UtcNow
        });

        _context.AuditLogs.Add(new AuditLog
        {
            Action = "REVOKE_SESSION",
            EntityType = "UserSession",
            EntityId = session.Id.ToString(),
            ActorName = _currentUser.Email ?? "Super Admin",
            ActorEmail = _currentUser.Email ?? "admin@platform.com",
            Details = $"Revoked session for user '{session.User?.Name}' ({session.User?.Email}) on device '{session.Device}'.",
            Module = "Security",
            Status = "success",
            Timestamp = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(ct);

        // Notify real-time client to terminate connection immediately
        try
        {
            await _hubContext.Clients.User(session.UserId.ToString()).SessionRevoked(session.TokenId, session.UserId);
            await _hubContext.Clients.Group($"user_{session.UserId}").SessionRevoked(session.TokenId, session.UserId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to broadcast SessionRevoked event via SignalR");
        }

        return Ok(ApiResponse<bool>.SuccessResult(true, "Session revoked successfully."));
    }

    [HttpPost("sessions/revoke-all")]
    public async Task<ActionResult<ApiResponse<int>>> RevokeAllSessions(
        [FromQuery] int? targetUserId = null,
        CancellationToken ct = default)
    {
        var currentJti = User.FindFirst(JwtRegisteredClaimNames.Jti)?.Value;

        var query = _context.UserSessions.Where(s => s.IsActive);
        if (targetUserId.HasValue)
        {
            query = query.Where(s => s.UserId == targetUserId.Value);
        }

        var sessions = await query.ToListAsync(ct);
        int revokedCount = 0;

        foreach (var s in sessions)
        {
            // Do not revoke the current caller's active session unless requested
            if (!string.IsNullOrEmpty(currentJti) && s.TokenId == currentJti && !targetUserId.HasValue)
            {
                continue;
            }

            s.IsActive = false;
            s.RevokedAt = DateTime.UtcNow;
            s.RevokedReason = "Bulk revocation by Super Admin";
            revokedCount++;

            try
            {
                await _hubContext.Clients.Group($"user_{s.UserId}").SessionRevoked(s.TokenId, s.UserId);
            }
            catch { }
        }

        _context.AuditLogs.Add(new AuditLog
        {
            Action = "REVOKE_ALL_SESSIONS",
            EntityType = "UserSession",
            EntityId = targetUserId.HasValue ? targetUserId.Value.ToString() : "ALL",
            ActorName = _currentUser.Email ?? "Super Admin",
            ActorEmail = _currentUser.Email ?? "admin@platform.com",
            Details = $"Super Admin revoked {revokedCount} active user sessions.",
            Module = "Security",
            Status = "success",
            Timestamp = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(ct);
        return Ok(ApiResponse<int>.SuccessResult(revokedCount, $"{revokedCount} sessions revoked successfully."));
    }

    [HttpGet("mfa/status")]
    public async Task<ActionResult<ApiResponse<object>>> GetMfaStatus(CancellationToken ct = default)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == _currentUser.UserId, ct);
        if (user == null) return NotFound(ApiResponse<object>.FailureResult("User not found."));

        int recoveryCodesCount = 0;
        if (!string.IsNullOrWhiteSpace(user.TwoFactorRecoveryCodesJson))
        {
            try
            {
                var codes = JsonSerializer.Deserialize<List<string>>(user.TwoFactorRecoveryCodesJson);
                recoveryCodesCount = codes?.Count ?? 0;
            }
            catch { }
        }

        return Ok(ApiResponse<object>.SuccessResult(new
        {
            isEnabled = user.IsTwoFactorEnabled,
            recoveryCodesRemaining = recoveryCodesCount,
            userEmail = user.Email
        }));
    }

    [HttpPost("mfa/setup")]
    public async Task<ActionResult<ApiResponse<MfaSetupResponseDto>>> SetupMfa(CancellationToken ct = default)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == _currentUser.UserId, ct);
        if (user == null) return NotFound(ApiResponse<MfaSetupResponseDto>.FailureResult("User not found."));

        var secret = _totpService.GenerateSecret();
        var qrCodeUri = _totpService.GenerateQrCodeUri(user.Email, secret);
        var recoveryCodes = _totpService.GenerateRecoveryCodes(8);

        // Stage secret and recovery codes temporarily on user record
        user.TwoFactorSecret = secret;
        user.TwoFactorRecoveryCodesJson = JsonSerializer.Serialize(recoveryCodes);
        await _context.SaveChangesAsync(ct);

        var response = new MfaSetupResponseDto
        {
            Secret = secret,
            QrCodeUri = qrCodeUri,
            ManualEntryKey = secret,
            RecoveryCodes = recoveryCodes
        };

        return Ok(ApiResponse<MfaSetupResponseDto>.SuccessResult(response, "MFA setup initiated. Please verify with a 6-digit code."));
    }

    [HttpPost("mfa/verify-and-enable")]
    public async Task<ActionResult<ApiResponse<bool>>> VerifyAndEnableMfa(
        [FromBody] MfaVerifyRequestDto req,
        CancellationToken ct = default)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == _currentUser.UserId, ct);
        if (user == null || string.IsNullOrWhiteSpace(user.TwoFactorSecret))
        {
            return BadRequest(ApiResponse<bool>.FailureResult("MFA setup was not initiated. Please run setup first."));
        }

        var cleanCode = req.Code.Trim().Replace(" ", "").Replace("-", "");
        var isValid = _totpService.ValidateTotp(user.TwoFactorSecret, cleanCode);

        if (!isValid)
        {
            return BadRequest(ApiResponse<bool>.FailureResult("Invalid authentication code. Please check your authenticator app and try again."));
        }

        user.IsTwoFactorEnabled = true;
        user.UpdatedAt = DateTime.UtcNow;

        _context.SecurityEvents.Add(new SecurityEvent
        {
            EventType = "MFA_ENABLED",
            Severity = "INFO",
            Description = $"Super Admin {user.Email} successfully enabled Two-Factor Authentication (TOTP).",
            UserEmail = user.Email,
            UserId = user.Id,
            Timestamp = DateTime.UtcNow
        });

        _context.AuditLogs.Add(new AuditLog
        {
            Action = "ENABLE_MFA",
            EntityType = "User",
            EntityId = user.Id.ToString(),
            ActorName = user.Name,
            ActorEmail = user.Email,
            Details = "Super Admin enrolled in mandatory Two-Factor Authentication.",
            Module = "Security",
            Status = "success",
            Timestamp = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(ct);
        return Ok(ApiResponse<bool>.SuccessResult(true, "Two-factor authentication enabled successfully."));
    }

    [HttpPost("mfa/disable")]
    public async Task<ActionResult<ApiResponse<bool>>> DisableMfa(
        [FromBody] MfaDisableRequestDto req,
        CancellationToken ct = default)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == _currentUser.UserId, ct);
        if (user == null) return NotFound(ApiResponse<bool>.FailureResult("User not found."));

        if (!PasswordHasher.VerifyPassword(req.Password, user.PasswordHash))
        {
            return BadRequest(ApiResponse<bool>.FailureResult("Password confirmation failed."));
        }

        user.IsTwoFactorEnabled = false;
        user.TwoFactorSecret = null;
        user.TwoFactorRecoveryCodesJson = null;
        user.UpdatedAt = DateTime.UtcNow;

        _context.SecurityEvents.Add(new SecurityEvent
        {
            EventType = "MFA_DISABLED",
            Severity = "WARNING",
            Description = $"Two-factor authentication disabled for user {user.Email}.",
            UserEmail = user.Email,
            UserId = user.Id,
            Timestamp = DateTime.UtcNow
        });

        _context.AuditLogs.Add(new AuditLog
        {
            Action = "DISABLE_MFA",
            EntityType = "User",
            EntityId = user.Id.ToString(),
            ActorName = user.Name,
            ActorEmail = user.Email,
            Details = "User disabled Two-Factor Authentication.",
            Module = "Security",
            Status = "success",
            Timestamp = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(ct);
        return Ok(ApiResponse<bool>.SuccessResult(true, "Two-factor authentication has been disabled."));
    }

    [HttpPost("mfa/regenerate-recovery-codes")]
    public async Task<ActionResult<ApiResponse<List<string>>>> RegenerateRecoveryCodes(CancellationToken ct = default)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == _currentUser.UserId, ct);
        if (user == null || !user.IsTwoFactorEnabled)
        {
            return BadRequest(ApiResponse<List<string>>.FailureResult("Two-factor authentication is not active."));
        }

        var newCodes = _totpService.GenerateRecoveryCodes(8);
        user.TwoFactorRecoveryCodesJson = JsonSerializer.Serialize(newCodes);
        user.UpdatedAt = DateTime.UtcNow;

        _context.AuditLogs.Add(new AuditLog
        {
            Action = "REGENERATE_MFA_RECOVERY_CODES",
            EntityType = "User",
            EntityId = user.Id.ToString(),
            ActorName = user.Name,
            ActorEmail = user.Email,
            Details = "Generated fresh two-factor recovery codes.",
            Module = "Security",
            Status = "success",
            Timestamp = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(ct);
        return Ok(ApiResponse<List<string>>.SuccessResult(newCodes, "Recovery codes regenerated successfully."));
    }

    [HttpGet("events")]
    public async Task<ActionResult<ApiResponse<PagedResult<SecurityEventDto>>>> GetSecurityEvents(
        [FromQuery] string? eventType = null,
        [FromQuery] string? severity = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken ct = default)
    {
        var query = _context.SecurityEvents.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(eventType) && !eventType.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(e => e.EventType == eventType);
        }

        if (!string.IsNullOrWhiteSpace(severity) && !severity.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(e => e.Severity == severity.ToUpperInvariant());
        }

        var total = await query.CountAsync(ct);
        var events = await query
            .OrderByDescending(e => e.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(e => new SecurityEventDto
            {
                Id = e.Id,
                EventType = e.EventType,
                Severity = e.Severity,
                Description = e.Details,
                IpAddress = e.IpAddress,
                UserEmail = e.ActorEmail,
                UserId = e.UserId,
                Timestamp = e.CreatedAt,
                Details = e.Details
            })
            .ToListAsync(ct);

        var pagedResult = PagedResult<SecurityEventDto>.Create(events, total, page, pageSize);
        return Ok(ApiResponse<PagedResult<SecurityEventDto>>.SuccessResult(pagedResult));
    }
}
