using backend.Authentication.Interfaces;
using backend.Configuration;
using backend.Data;
using backend.Models.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Twilio.Security;
using Twilio.TwiML;
using Twilio.TwiML.Voice;

namespace backend.Controllers.Voice;

/// <summary>
/// TwiML webhook endpoints for Twilio Programmable Voice.
/// These endpoints are called directly by Twilio, not by the browser.
/// All incoming requests are validated using Twilio request signatures.
/// </summary>
[ApiController]
[Route("api/voice/twiml")]
public class TwiMLController : ControllerBase
{
    private readonly IOptions<TwilioSettings> _twilioOptions;
    private readonly ApplicationDbContext _context;
    private readonly ILogger<TwiMLController> _logger;

    public TwiMLController(
        IOptions<TwilioSettings> twilioOptions,
        ApplicationDbContext context,
        ILogger<TwiMLController> logger)
    {
        _twilioOptions = twilioOptions;
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// POST /api/voice/twiml/outbound
    /// Called by Twilio when an agent makes an outbound call via the Voice SDK.
    /// Returns TwiML instructing Twilio to dial the destination number.
    /// Configure this URL as the Voice Request URL in your TwiML App.
    /// </summary>
    [HttpPost("outbound")]
    [Consumes("application/x-www-form-urlencoded")]
    public IActionResult OutboundTwiML([FromForm] TwilioVoiceWebhookDto form)
    {
        if (!ValidateSignature())
        {
            _logger.LogWarning("Twilio outbound webhook: invalid signature from {IP}", HttpContext.Connection.RemoteIpAddress);
            return StatusCode(403, "Forbidden: Invalid Twilio signature.");
        }

        var settings = _twilioOptions.Value;
        var to = form.To?.Trim();

        _logger.LogInformation(
            "Outbound TwiML request: CallSid={CallSid} From={From} To={To} Direction={Direction}",
            form.CallSid, form.From, to, form.Direction);

        if (string.IsNullOrWhiteSpace(to))
        {
            _logger.LogWarning("Outbound TwiML: missing 'To' parameter.");
            var errorResp = new VoiceResponse();
            errorResp.Say("The destination number is missing. Please try again.");
            return Content(errorResp.ToString(), "application/xml");
        }

        var response = new VoiceResponse();
        var dial = new Dial(
            callerId: settings.CallerNumber,
            record: Dial.RecordEnum.RecordFromAnswer,
            recordingStatusCallback: new Uri($"{GetBaseUrl()}/api/voice/twiml/recording-status"),
            recordingStatusCallbackMethod: Twilio.Http.HttpMethod.Post);

        dial.Append(new Number(to));
        response.Append(dial);

        return Content(response.ToString(), "application/xml");
    }

    /// <summary>
    /// POST /api/voice/twiml/inbound
    /// Called by Twilio when a call arrives on your Twilio phone number.
    /// Routes the call to the appropriate agent's browser client.
    /// Configure this URL as the Voice Configuration URL on your Twilio phone number.
    /// </summary>
    [HttpPost("inbound")]
    [Consumes("application/x-www-form-urlencoded")]
    public async Task<IActionResult> InboundTwiML([FromForm] TwilioVoiceWebhookDto form, CancellationToken ct = default)
    {
        if (!ValidateSignature())
        {
            _logger.LogWarning("Twilio inbound webhook: invalid signature from {IP}", HttpContext.Connection.RemoteIpAddress);
            return StatusCode(403, "Forbidden: Invalid Twilio signature.");
        }

        _logger.LogInformation(
            "Inbound TwiML: CallSid={CallSid} From={From} To={To}",
            form.CallSid, form.From, form.To);

        // Try to find which company owns this DID (To number)
        var didMapping = await _context.TenantDidMappings
            .Include(m => m.Tenant)
            .FirstOrDefaultAsync(m => m.PhoneNumber == form.To, ct);

        // Find an available agent for this tenant.
        // If DID mapping is found, target agents in that company; otherwise fall back to company 1.
        var companyId = didMapping?.TenantId ?? 1;
        var agents = await _context.Users
            .AsNoTracking()
            .Include(u => u.Role)
            .Where(u => u.CompanyId == companyId && u.Role != null &&
                        (u.Role.Code == "sales_executive" || u.Role.Code == "irm" || u.Role.Code == "company_admin"))
            .ToListAsync(ct);

        var response = new VoiceResponse();

        if (!agents.Any())
        {
            _logger.LogWarning("Inbound TwiML: no available agents for company {CompanyId}", companyId);
            response.Say("Thank you for calling. All our representatives are currently unavailable. Please try again later.");
            return Content(response.ToString(), "application/xml");
        }

        var dial = new Dial(
            callerId: form.From ?? string.Empty,
            action: new Uri($"{GetBaseUrl()}/api/voice/twiml/call-status"),
            method: Twilio.Http.HttpMethod.Post,
            record: Dial.RecordEnum.RecordFromAnswer,
            recordingStatusCallback: new Uri($"{GetBaseUrl()}/api/voice/twiml/recording-status"),
            recordingStatusCallbackMethod: Twilio.Http.HttpMethod.Post);

        // Ring all available agents simultaneously — first to answer wins.
        foreach (var agent in agents.Take(5)) // Limit to 5 simultaneous rings
        {
            var agentIdentity = $"agent_{agent.Id}_{companyId}";
            dial.Append(new Client(agentIdentity));
        }

        response.Append(dial);
        return Content(response.ToString(), "application/xml");
    }

    /// <summary>
    /// POST /api/voice/twiml/call-status
    /// Called by Twilio when a call's status changes (ringing, in-progress, completed, etc.)
    /// Persists provider-confirmed status and duration to the CallRecord.
    /// </summary>
    [HttpPost("call-status")]
    [Consumes("application/x-www-form-urlencoded")]
    public async Task<IActionResult> CallStatusCallback([FromForm] TwilioCallStatusDto form, CancellationToken ct = default)
    {
        if (!ValidateSignature())
        {
            _logger.LogWarning("Twilio call-status webhook: invalid signature.");
            return StatusCode(403, "Forbidden");
        }

        _logger.LogInformation(
            "Call status: CallSid={CallSid} Status={Status} Duration={Duration}",
            form.CallSid, form.CallStatus, form.CallDuration);

        if (string.IsNullOrWhiteSpace(form.CallSid)) return Ok();

        var callRecord = await _context.CallRecords
            .FirstOrDefaultAsync(c => c.TwilioCallSid == form.CallSid, ct);

        if (callRecord == null) return Ok(); // Record not yet created (created on disposition)

        // Only update with provider-confirmed duration on completion
        if (form.CallStatus is "completed" or "busy" or "no-answer" or "failed" or "canceled")
        {
            if (int.TryParse(form.CallDuration, out var duration))
            {
                callRecord.Duration = duration;
            }

            callRecord.Disposition = form.CallStatus switch
            {
                "completed" => callRecord.Disposition, // Keep agent-set disposition
                "busy" => "No Response",
                "no-answer" => "No Response",
                "failed" => "No Response",
                "canceled" => "No Response",
                _ => callRecord.Disposition,
            };

            await _context.SaveChangesAsync(ct);
        }

        return Ok();
    }

    /// <summary>
    /// POST /api/voice/twiml/recording-status
    /// Called by Twilio when a recording is ready.
    /// Persists the recording URL to the associated CallRecord.
    /// </summary>
    [HttpPost("recording-status")]
    [Consumes("application/x-www-form-urlencoded")]
    public async Task<IActionResult> RecordingStatusCallback([FromForm] TwilioRecordingStatusDto form, CancellationToken ct = default)
    {
        if (!ValidateSignature())
        {
            _logger.LogWarning("Twilio recording-status webhook: invalid signature.");
            return StatusCode(403, "Forbidden");
        }

        _logger.LogInformation(
            "Recording ready: CallSid={CallSid} RecordingSid={RecordingSid} Status={Status}",
            form.CallSid, form.RecordingSid, form.RecordingStatus);

        if (string.IsNullOrWhiteSpace(form.CallSid) || form.RecordingStatus != "completed") return Ok();

        var callRecord = await _context.CallRecords
            .FirstOrDefaultAsync(c => c.TwilioCallSid == form.CallSid, ct);

        if (callRecord == null) return Ok();

        // Store recording SID only — the actual URL is generated on-demand by the secure playback endpoint
        // so that Twilio credentials never reach the browser.
        callRecord.RecordingUrl = $"recording:{form.RecordingSid}";
        await _context.SaveChangesAsync(ct);

        return Ok();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private bool ValidateSignature()
    {
        var settings = _twilioOptions.Value;
        var env = HttpContext.RequestServices.GetService<IWebHostEnvironment>();

        if (string.IsNullOrWhiteSpace(settings.AuthToken))
        {
            // Auth token not configured — skip validation only in Development
            if (env?.IsProduction() == true)
            {
                _logger.LogError("Twilio Auth Token is not configured. Webhook signature validation failed.");
                return false;
            }
            _logger.LogWarning("Twilio Auth Token not configured. Skipping signature validation (Development only).");
            return true;
        }

        var proto = Request.Headers["X-Forwarded-Proto"].FirstOrDefault() ?? Request.Scheme;
        var host = Request.Headers["X-Forwarded-Host"].FirstOrDefault() ?? Request.Host.Value;
        var requestUrl = $"{proto}://{host}{Request.Path}{Request.QueryString}";
        var twilioSignature = Request.Headers["X-Twilio-Signature"].FirstOrDefault() ?? string.Empty;

        // If no signature header is provided in Development, permit for local testing
        if (string.IsNullOrWhiteSpace(twilioSignature))
        {
            if (env?.IsDevelopment() == true)
            {
                _logger.LogWarning("Missing X-Twilio-Signature header. Permitted in Development environment.");
                return true;
            }
            return false;
        }

        var validator = new RequestValidator(settings.AuthToken);

        // Build the form POST parameters for validation
        var parameters = new Dictionary<string, string>();
        if (Request.HasFormContentType)
        {
            foreach (var (key, value) in Request.Form)
            {
                parameters[key] = value.ToString();
            }
        }

        var isValid = validator.Validate(requestUrl, parameters, twilioSignature);
        if (!isValid)
        {
            // Try with flipped scheme (https <-> http) in case proxy handled TLS termination
            var altProto = proto == "https" ? "http" : "https";
            var altUrl = $"{altProto}://{host}{Request.Path}{Request.QueryString}";
            isValid = validator.Validate(altUrl, parameters, twilioSignature);
        }

        if (!isValid && env?.IsDevelopment() == true)
        {
            _logger.LogWarning("Twilio signature validation failed for {Url}. Permitted because environment is Development.", requestUrl);
            return true;
        }

        return isValid;
    }

    private string GetBaseUrl()
    {
        var proto = Request.Headers["X-Forwarded-Proto"].FirstOrDefault() ?? Request.Scheme;
        var host = Request.Headers["X-Forwarded-Host"].FirstOrDefault() ?? Request.Host.Value;
        return $"{proto}://{host}";
    }
}

// ── DTOs for Twilio webhook form posts ────────────────────────────────────────

public class TwilioVoiceWebhookDto
{
    public string? CallSid { get; set; }
    public string? From { get; set; }
    public string? To { get; set; }
    public string? Direction { get; set; }
    public string? CallStatus { get; set; }
    public string? AccountSid { get; set; }
}

public class TwilioCallStatusDto
{
    public string? CallSid { get; set; }
    public string? CallStatus { get; set; }
    public string? CallDuration { get; set; }
    public string? From { get; set; }
    public string? To { get; set; }
}

public class TwilioRecordingStatusDto
{
    public string? CallSid { get; set; }
    public string? RecordingSid { get; set; }
    public string? RecordingStatus { get; set; }
    public string? RecordingUrl { get; set; }
    public string? RecordingDuration { get; set; }
}
