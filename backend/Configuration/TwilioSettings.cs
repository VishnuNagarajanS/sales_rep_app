namespace backend.Configuration;

/// <summary>
/// Twilio Programmable Voice settings.
/// Load from environment variables or User Secrets — never hardcode.
/// 
/// Required keys (User Secrets / environment):
///   Twilio:AccountSid        — AC… account SID
///   Twilio:ApiKeySid         — SK… API key SID (not the Auth Token)
///   Twilio:ApiKeySecret      — API key secret
///   Twilio:TwiMLAppSid       — AP… TwiML App SID
///   Twilio:CallerNumber      — E.164 caller ID, e.g. +14155551234
///   Twilio:AuthToken         — Auth Token (only used for webhook signature validation)
/// </summary>
public class TwilioSettings
{
    public const string SectionName = "Twilio";

    /// <summary>Main Twilio Account SID (AC…).</summary>
    public string AccountSid { get; set; } = string.Empty;

    /// <summary>API Key SID (SK…) used to sign access tokens. Preferred over Auth Token for client-side grants.</summary>
    public string ApiKeySid { get; set; } = string.Empty;

    /// <summary>Secret for the API key above. Never expose to the browser.</summary>
    public string ApiKeySecret { get; set; } = string.Empty;

    /// <summary>TwiML Application SID (AP…) for outbound call instructions.</summary>
    public string TwiMLAppSid { get; set; } = string.Empty;

    /// <summary>E.164 formatted caller number to display as the calling party.</summary>
    public string CallerNumber { get; set; } = string.Empty;

    /// <summary>Auth Token used only for server-side webhook signature validation. Never sent to browser.</summary>
    public string AuthToken { get; set; } = string.Empty;

    /// <summary>Lifetime in seconds for each access token (default 3600 = 1 hour).</summary>
    public int TokenTtlSeconds { get; set; } = 3600;

    /// <summary>Returns true when all required fields are populated.</summary>
    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(AccountSid) &&
        !string.IsNullOrWhiteSpace(ApiKeySid) &&
        !string.IsNullOrWhiteSpace(ApiKeySecret) &&
        !string.IsNullOrWhiteSpace(TwiMLAppSid) &&
        !string.IsNullOrWhiteSpace(CallerNumber);
}
