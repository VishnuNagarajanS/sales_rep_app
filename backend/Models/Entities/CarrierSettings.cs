namespace backend.Models.Entities;

public class CarrierSettings
{
    public int Id { get; set; }
    public string PrimaryCarrier { get; set; } = "Twilio Elastic SIP Trunking (Mumbai AP-South)";
    public string SecondaryCarrier { get; set; } = "Exotel Cloud Gateway (Failover Redundant)";
    public string SipRealm { get; set; } = "sip.trunk.nexusplatform.io:5060";
    public string WebrtcGatewayUrl { get; set; } = "wss://webrtc.nexusplatform.io/gateway";
    public int RecordingRetentionDays { get; set; } = 180;
    public int MaxConcurrentChannels { get; set; } = 100;
    public bool EmergencyRoutingEnabled { get; set; } = true;
    public string WhisperAiModel { get; set; } = "OpenAI Whisper-Large-v3 (Self-Hosted on GPU cluster)";
    
    // Encrypted / Protected credentials
    public string? AccountSid { get; set; }
    public string? AuthTokenEncrypted { get; set; }
    public string? PrimaryGatewayHost { get; set; } = "sip.trunk.nexusplatform.io";
    public string? FailoverGatewayHost { get; set; } = "gateway.exotel.com";
    public string Status { get; set; } = "Active";
    public DateTime? LastTestedAt { get; set; }
    public string? TestStatus { get; set; } = "Success";
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
