using backend.Authentication.Interfaces;
using backend.Configuration;
using backend.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Twilio;
using Twilio.Rest.Api.V2010.Account;

namespace backend.Controllers.Voice;

/// <summary>
/// Serves Twilio call recording audio securely.
/// The browser never receives Twilio credentials or raw recording URLs.
/// Instead, the browser calls this endpoint with the call record ID,
/// and the backend fetches the recording from Twilio using server-side credentials,
/// then proxies it to the browser.
/// </summary>
[ApiController]
[Route("api/voice/recordings")]
[Authorize]
public class RecordingPlaybackController : ControllerBase
{
    private readonly IOptions<TwilioSettings> _twilioOptions;
    private readonly ICurrentUserService _currentUser;
    private readonly ApplicationDbContext _context;
    private readonly ILogger<RecordingPlaybackController> _logger;
    private readonly IHttpClientFactory _httpClientFactory;

    public RecordingPlaybackController(
        IOptions<TwilioSettings> twilioOptions,
        ICurrentUserService currentUser,
        ApplicationDbContext context,
        ILogger<RecordingPlaybackController> logger,
        IHttpClientFactory httpClientFactory)
    {
        _twilioOptions = twilioOptions;
        _currentUser = currentUser;
        _context = context;
        _logger = logger;
        _httpClientFactory = httpClientFactory;
    }

    /// <summary>
    /// GET /api/voice/recordings/{callRecordId}
    /// Returns the recording audio for the given call record.
    /// Requires the caller to be authenticated and to have access to this call record.
    /// </summary>
    [HttpGet("{callRecordId:int}")]
    public async Task<IActionResult> GetRecording(int callRecordId, CancellationToken ct = default)
    {
        var settings = _twilioOptions.Value;
        if (!settings.IsConfigured || string.IsNullOrWhiteSpace(settings.AccountSid) || string.IsNullOrWhiteSpace(settings.AuthToken))
        {
            return NotFound("Recording playback is unavailable: Twilio is not configured.");
        }

        var agentId = _currentUser.UserId;
        var role = (_currentUser.Role ?? "").ToLowerInvariant();
        var companyId = _currentUser.CompanyId;

        var callRecord = await _context.CallRecords
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == callRecordId, ct);

        if (callRecord == null)
            return NotFound("Call record not found.");

        // Authorization: only agents from the same company (or super_admin) can access recordings
        if (role != "super_admin" && companyId.HasValue && callRecord.CompanyId != companyId.Value)
            return StatusCode(403, "Access denied.");

        if (string.IsNullOrWhiteSpace(callRecord.RecordingUrl) || !callRecord.RecordingUrl.StartsWith("recording:"))
            return NotFound("No recording available for this call.");

        var recordingSid = callRecord.RecordingUrl.Replace("recording:", "");

        try
        {
            // Fetch recording metadata from Twilio using server-side credentials
            TwilioClient.Init(settings.AccountSid, settings.AuthToken);
            var recording = await RecordingResource.FetchAsync(recordingSid);

            // Construct the media URL and proxy audio through the backend
            var mediaUrl = $"https://api.twilio.com/2010-04-01/Accounts/{settings.AccountSid}/Recordings/{recordingSid}.mp3";

            var client = _httpClientFactory.CreateClient("TwilioRecordings");
            // Add Basic Auth using AccountSid:AuthToken
            var credentials = Convert.ToBase64String(
                System.Text.Encoding.ASCII.GetBytes($"{settings.AccountSid}:{settings.AuthToken}"));
            client.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Basic", credentials);

            using var response = await client.GetAsync(mediaUrl, HttpCompletionOption.ResponseHeadersRead, ct);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to fetch recording {Sid}: {Status}", recordingSid, response.StatusCode);
                return StatusCode(502, "Failed to retrieve recording from provider.");
            }

            var stream = await response.Content.ReadAsStreamAsync(ct);
            Response.Headers["Content-Disposition"] = $"inline; filename=\"call-{callRecordId}.mp3\"";
            return File(stream, "audio/mpeg");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching recording for call {CallRecordId}", callRecordId);
            return StatusCode(500, "Failed to retrieve recording.");
        }
    }
}
