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
    private readonly IMfaService _mfaService;
    private readonly IHubContext<PlatformHub, IPlatformHubClient> _hubContext;
    private readonly ILogger<PlatformSecurityController> _logger;

    public PlatformSecurityController(
        ApplicationDbContext context,
        ICurrentUserService currentUser,
        ITotpService totpService,
        IMfaService mfaService,
        IHubContext<PlatformHub, IPlatformHubClient> hubContext,
        ILogger<PlatformSecurityController> logger)
    {
        _context = context;
        _currentUser = currentUser;
        _totpService = totpService;
        _mfaService = mfaService;
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
        var userId = _currentUser.UserId.GetValueOrDefault();
        if (userId <= 0) return Unauthorized(ApiResponse<object>.FailureResult("User not authenticated."));

        var status = await _mfaService.GetStatusAsync(userId, ct);
        return Ok(ApiResponse<object>.SuccessResult(new
        {
            isEnabled = status.IsTwoFactorEnabled,
            isTwoFactorEnabled = status.IsTwoFactorEnabled,
            recoveryCodesRemaining = status.RemainingRecoveryCodes,
            remainingRecoveryCodes = status.RemainingRecoveryCodes,
            userEmail = status.UserEmail
        }));
    }

    [HttpPost("mfa/setup")]
    public async Task<ActionResult<ApiResponse<MfaSetupResponseDto>>> SetupMfa(CancellationToken ct = default)
    {
        var userId = _currentUser.UserId.GetValueOrDefault();
        if (userId <= 0) return Unauthorized(ApiResponse<MfaSetupResponseDto>.FailureResult("User not authenticated."));

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user == null) return NotFound(ApiResponse<MfaSetupResponseDto>.FailureResult("User not found."));

        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        var ua = Request.Headers["User-Agent"].ToString();

        var res = await _mfaService.SetupAsync(userId, user.Email, ip, ua, ct);
        if (!res.Success || res.Data == null)
            return BadRequest(ApiResponse<MfaSetupResponseDto>.FailureResult(res.Message ?? "Failed to initiate MFA setup."));

        var response = new MfaSetupResponseDto
        {
            Secret = res.Data.Secret,
            QrCodeUri = res.Data.QrCodeUri,
            ManualEntryKey = res.Data.ManualEntryKey,
            RecoveryCodes = res.Data.RecoveryCodes
        };

        return Ok(ApiResponse<MfaSetupResponseDto>.SuccessResult(response, res.Message));
    }

    [HttpPost("mfa/verify-and-enable")]
    public async Task<ActionResult<ApiResponse<object>>> VerifyAndEnableMfa(
        [FromBody] MfaVerifyRequestDto req,
        CancellationToken ct = default)
    {
        var userId = _currentUser.UserId.GetValueOrDefault();
        if (userId <= 0) return Unauthorized(ApiResponse<object>.FailureResult("User not authenticated."));

        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        var ua = Request.Headers["User-Agent"].ToString();

        var res = await _mfaService.VerifySetupAsync(userId, req.Code, ip, ua, ct);
        if (!res.Success)
            return BadRequest(ApiResponse<object>.FailureResult(res.Message ?? "Invalid verification code."));

        return Ok(ApiResponse<object>.SuccessResult(new
        {
            success = true,
            recoveryCodes = res.Data?.RecoveryCodes ?? new List<string>()
        }, "Two-factor authentication enabled successfully."));
    }

    [HttpPost("mfa/disable")]
    public async Task<ActionResult<ApiResponse<bool>>> DisableMfa(
        [FromBody] MfaDisableRequestDto req,
        CancellationToken ct = default)
    {
        var userId = _currentUser.UserId.GetValueOrDefault();
        if (userId <= 0) return Unauthorized(ApiResponse<bool>.FailureResult("User not authenticated."));

        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        var ua = Request.Headers["User-Agent"].ToString();

        var password = !string.IsNullOrWhiteSpace(req.Password) ? req.Password : (req.Code ?? string.Empty);
        var res = await _mfaService.DisableMfaAsync(userId, password, req.Code, ip, ua, ct);
        if (!res.Success)
            return BadRequest(ApiResponse<bool>.FailureResult(res.Message ?? "Failed to disable MFA."));

        return Ok(res);
    }

    [HttpPost("mfa/regenerate-recovery-codes")]
    public async Task<ActionResult<ApiResponse<List<string>>>> RegenerateRecoveryCodes(
        [FromBody] backend.DTOs.Auth.MfaRegenerateCodesRequestDto? req = null,
        CancellationToken ct = default)
    {
        var userId = _currentUser.UserId.GetValueOrDefault();
        if (userId <= 0) return Unauthorized(ApiResponse<List<string>>.FailureResult("User not authenticated."));

        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        var ua = Request.Headers["User-Agent"].ToString();

        var password = req?.Password ?? string.Empty;
        var code = req?.Code;

        var res = await _mfaService.RegenerateRecoveryCodesAsync(userId, password, code, ip, ua, ct);
        if (!res.Success)
            return BadRequest(ApiResponse<List<string>>.FailureResult(res.Message ?? "Failed to regenerate recovery codes."));

        return Ok(res);
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
