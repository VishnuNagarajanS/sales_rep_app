using backend.Authentication.Interfaces;
using backend.Configuration;
using backend.Data;
using backend.DTOs.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Twilio.Jwt.AccessToken;

namespace backend.Controllers.Voice;

/// <summary>
/// Issues short-lived Twilio Voice access tokens for authenticated agents.
/// The token grants the calling client a VoiceGrant scoped to the configured TwiML App.
/// Credentials are never returned to the browser — only the signed JWT token is.
/// </summary>
[ApiController]
[Route("api/voice")]
[Authorize]
public class VoiceTokenController : ControllerBase
{
    private readonly IOptions<TwilioSettings> _twilioOptions;
    private readonly ICurrentUserService _currentUser;
    private readonly ApplicationDbContext _context;
    private readonly ILogger<VoiceTokenController> _logger;

    public VoiceTokenController(
        IOptions<TwilioSettings> twilioOptions,
        ICurrentUserService currentUser,
        ApplicationDbContext context,
        ILogger<VoiceTokenController> logger)
    {
        _twilioOptions = twilioOptions;
        _currentUser = currentUser;
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// GET /api/voice/token
    /// Returns a short-lived Twilio Voice access token for the authenticated agent.
    /// The browser uses this token to register a Twilio Device for real calls.
    /// </summary>
    [HttpGet("token")]
    public async Task<ActionResult<ApiResponse<VoiceTokenResponseDto>>> GetToken(CancellationToken ct = default)
    {
        var settings = _twilioOptions.Value;

        if (!settings.IsConfigured)
        {
            _logger.LogWarning("Twilio voice token requested but Twilio is not configured.");
            return Ok(ApiResponse<VoiceTokenResponseDto>.FailureResult(
                "Twilio is not configured on this server. Contact your administrator to set up Twilio credentials.",
                new VoiceTokenResponseDto { IsConfigured = false }));
        }

        var agentId = _currentUser.UserId ?? 1;
        var companyId = _currentUser.CompanyId ?? 1;
        var identity = $"agent_{agentId}_{companyId}";

        try
        {
            // Grant Voice capabilities scoped to the TwiML App
            var voiceGrant = new VoiceGrant
            {
                OutgoingApplicationSid = settings.TwiMLAppSid,
                IncomingAllow = true,
            };
            var grants = new HashSet<IGrant> { voiceGrant };
            var expiration = DateTime.UtcNow.AddSeconds(settings.TokenTtlSeconds);

            var token = new Token(
                accountSid: settings.AccountSid,
                signingKeySid: settings.ApiKeySid,
                secret: settings.ApiKeySecret,
                identity: identity,
                expiration: expiration,
                grants: grants);

            var jwt = token.ToJwt();

            _logger.LogInformation(
                "Issued Twilio voice token for agent {AgentId} (identity={Identity}), TTL={Ttl}s",
                agentId, identity, settings.TokenTtlSeconds);

            return Ok(ApiResponse<VoiceTokenResponseDto>.SuccessResult(
                new VoiceTokenResponseDto
                {
                    Token = jwt,
                    Identity = identity,
                    TtlSeconds = settings.TokenTtlSeconds,
                    IsConfigured = true,
                },
                "Voice access token issued."));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to generate Twilio voice token for agent {AgentId}", agentId);
            return StatusCode(500, ApiResponse<VoiceTokenResponseDto>.FailureResult(
                "Failed to generate voice access token. Check server logs."));
        }
    }

    /// <summary>
    /// GET /api/voice/status
    /// Returns whether Twilio is configured, without exposing any credentials.
    /// </summary>
    [HttpGet("status")]
    [AllowAnonymous]
    public ActionResult<ApiResponse<TwilioStatusDto>> GetStatus()
    {
        var settings = _twilioOptions.Value;
        return Ok(ApiResponse<TwilioStatusDto>.SuccessResult(new TwilioStatusDto
        {
            IsConfigured = settings.IsConfigured,
            HasAccountSid = !string.IsNullOrWhiteSpace(settings.AccountSid),
            HasTwiMLApp = !string.IsNullOrWhiteSpace(settings.TwiMLAppSid),
            HasCallerNumber = !string.IsNullOrWhiteSpace(settings.CallerNumber),
            Message = settings.IsConfigured
                ? "Twilio Programmable Voice is configured and ready."
                : "Twilio credentials are not configured. Set Twilio:AccountSid, Twilio:ApiKeySid, Twilio:ApiKeySecret, Twilio:TwiMLAppSid, and Twilio:CallerNumber in environment variables or User Secrets.",
        }, "Twilio status retrieved."));
    }
}

public class VoiceTokenResponseDto
{
    /// <summary>Signed JWT access token for the Twilio Voice SDK. Never log or expose in frontend state.</summary>
    public string? Token { get; set; }
    /// <summary>Agent identity string embedded in the token (safe to expose).</summary>
    public string? Identity { get; set; }
    /// <summary>Token lifetime in seconds.</summary>
    public int TtlSeconds { get; set; }
    /// <summary>False when Twilio is not configured on the server.</summary>
    public bool IsConfigured { get; set; }
}

public class TwilioStatusDto
{
    public bool IsConfigured { get; set; }
    public bool HasAccountSid { get; set; }
    public bool HasTwiMLApp { get; set; }
    public bool HasCallerNumber { get; set; }
    public string Message { get; set; } = string.Empty;
}
