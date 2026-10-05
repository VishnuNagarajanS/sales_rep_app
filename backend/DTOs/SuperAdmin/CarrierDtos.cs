namespace backend.DTOs.SuperAdmin;

public class CarrierSettingsResponseDto
{
    public string PrimaryCarrier { get; set; } = string.Empty;
    public string SecondaryCarrier { get; set; } = string.Empty;
    public string SipRealm { get; set; } = string.Empty;
    public string WebrtcGatewayUrl { get; set; } = string.Empty;
    public int RecordingRetentionDays { get; set; }
    public int MaxConcurrentChannels { get; set; }
    public bool EmergencyRoutingEnabled { get; set; }
    public string WhisperAiModel { get; set; } = string.Empty;
    public string? LastTestedAt { get; set; }
    public string? TestStatus { get; set; }

    // Masked credential info (Never return raw Auth tokens!)
    public bool HasAccountSid { get; set; }
    public bool HasAuthToken { get; set; }
    public string? MaskedAccountSid { get; set; }
    public string? PrimaryGatewayHost { get; set; }
    public string? FailoverGatewayHost { get; set; }
    public string Status { get; set; } = "Active";
    public string PrimaryTrunkHealth { get; set; } = "online";
    public string FailoverTrunkHealth { get; set; } = "online";
    public string SpeechToTextHealth { get; set; } = "online";
}


public class UpdateCarrierSettingsRequestDto
{
    public string PrimaryCarrier { get; set; } = string.Empty;
    public string? SecondaryCarrier { get; set; }
    public string? SipRealm { get; set; }
    public string? WebrtcGatewayUrl { get; set; }
    public int RecordingRetentionDays { get; set; } = 180;
    public int MaxConcurrentChannels { get; set; } = 100;
    public bool EmergencyRoutingEnabled { get; set; } = true;
    public string? WhisperAiModel { get; set; }
    
    // Optional credential updates
    public string? AccountSid { get; set; }
    public string? AuthToken { get; set; }
    public string? PrimaryGatewayHost { get; set; }
    public string? FailoverGatewayHost { get; set; }
    public string? Status { get; set; }
}

public class CarrierTestResultDto
{
    public bool Success { get; set; }
    public int LatencyMs { get; set; }
    public string Message { get; set; } = string.Empty;
    public DateTime TestedAt { get; set; } = DateTime.UtcNow;
}

public class SimulateCallRequestDto
{
    public string PhoneNumber { get; set; } = string.Empty;
}

public class SimulateCallResultDto
{
    public bool Success { get; set; }
    public string PhoneNumber { get; set; } = string.Empty;
    public string TenantName { get; set; } = string.Empty;
    public string RoutingStrategy { get; set; } = string.Empty;
    public string QueueName { get; set; } = string.Empty;
    public List<string> TraceLogs { get; set; } = new();
    public DateTime ExecutedAt { get; set; } = DateTime.UtcNow;
}

