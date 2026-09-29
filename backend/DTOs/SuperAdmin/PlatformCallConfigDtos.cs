namespace backend.DTOs.SuperAdmin;

public class TenantDidMappingDto
{
    public string Id { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string? TenantId { get; set; }
    public string? TenantName { get; set; }
    public string? TenantSlug { get; set; }
    public string RoutingStrategy { get; set; } = "Round-Robin";
    public string QueueName { get; set; } = "Inbound Queue";
    public bool EnableRecording { get; set; } = true;
    public bool EnableAiWhisper { get; set; } = true;
    public string Status { get; set; } = "Online";
    public int ChannelsCount { get; set; } = 8;
    public string AllocatedAt { get; set; } = string.Empty;
    public string? Notes { get; set; }
}

public class CreateDidMappingDto
{
    public string PhoneNumber { get; set; } = string.Empty;
    public string? TenantId { get; set; }
    public string RoutingStrategy { get; set; } = "Round-Robin";
    public string QueueName { get; set; } = "Inbound Sales Queue";
    public bool EnableRecording { get; set; } = true;
    public bool EnableAiWhisper { get; set; } = true;
    public string Status { get; set; } = "Online";
    public int ChannelsCount { get; set; } = 8;
    public string? Notes { get; set; }
}

public class UpdateDidMappingDto
{
    public string? PhoneNumber { get; set; }
    public string? TenantId { get; set; }
    public string? RoutingStrategy { get; set; }
    public string? QueueName { get; set; }
    public bool? EnableRecording { get; set; }
    public bool? EnableAiWhisper { get; set; }
    public string? Status { get; set; }
    public int? ChannelsCount { get; set; }
    public string? Notes { get; set; }
}

public class PlatformCarrierSettingsDto
{
    public string PrimaryCarrier { get; set; } = string.Empty;
    public string SecondaryCarrier { get; set; } = string.Empty;
    public string SipRealm { get; set; } = string.Empty;
    public string WebRtcGatewayUrl { get; set; } = string.Empty;
    public int RecordingRetentionDays { get; set; }
    public int MaxConcurrentChannels { get; set; }
    public bool EmergencyRoutingEnabled { get; set; }
    public string WhisperAiModel { get; set; } = string.Empty;
    public string? LastTestedAt { get; set; }
    public string? TestStatus { get; set; }
}

public class UpdateCarrierSettingsDto
{
    public string? PrimaryCarrier { get; set; }
    public string? SecondaryCarrier { get; set; }
    public string? SipRealm { get; set; }
    public string? WebRtcGatewayUrl { get; set; }
    public int? RecordingRetentionDays { get; set; }
    public int? MaxConcurrentChannels { get; set; }
    public bool? EmergencyRoutingEnabled { get; set; }
    public string? WhisperAiModel { get; set; }
}

public class CarrierTestResultDto
{
    public bool Success { get; set; }
    public int LatencyMs { get; set; }
    public string Message { get; set; } = string.Empty;
    public string TestedAt { get; set; } = string.Empty;
}
