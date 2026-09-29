namespace backend.Models.Entities;

public class PlatformCarrierSettings
{
    public int Id { get; set; } = 1;
    public string PrimaryCarrier { get; set; } = "Twilio Elastic SIP Trunking (Mumbai AP-South)";
    public string SecondaryCarrier { get; set; } = "Exotel Cloud Gateway (Failover Redundant)";
    public string SipRealm { get; set; } = "sip.trunk.nexusplatform.io:5060";
    public string WebRtcGatewayUrl { get; set; } = "wss://webrtc.nexusplatform.io/gateway";
    public int RecordingRetentionDays { get; set; } = 180;
    public int MaxConcurrentChannels { get; set; } = 100;
    public bool EmergencyRoutingEnabled { get; set; } = true;
    public string WhisperAiModel { get; set; } = "OpenAI Whisper-Large-v3 (Self-Hosted on GPU cluster)";
    public DateTime? LastTestedAt { get; set; }
    public string? TestStatus { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
