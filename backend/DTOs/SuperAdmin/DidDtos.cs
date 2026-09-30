namespace backend.DTOs.SuperAdmin;

public class CreateDidRequestDto
{
    public string PhoneNumber { get; set; } = string.Empty;
    public string? TenantId { get; set; } // string or empty
    public string? RoutingStrategy { get; set; }
    public string? QueueName { get; set; }
    public bool EnableRecording { get; set; } = true;
    public bool EnableAiWhisper { get; set; } = true;
    public int ChannelsCount { get; set; } = 8;
    public string? Status { get; set; }
    public string? Notes { get; set; }
}

public class UpdateDidRequestDto
{
    public string PhoneNumber { get; set; } = string.Empty;
    public string? TenantId { get; set; }
    public string? RoutingStrategy { get; set; }
    public string? QueueName { get; set; }
    public bool EnableRecording { get; set; } = true;
    public bool EnableAiWhisper { get; set; } = true;
    public int ChannelsCount { get; set; } = 8;
    public string? Status { get; set; }
    public string? Notes { get; set; }
}

public class DidStatusUpdateDto
{
    public string Status { get; set; } = "Online"; // Online, Offline, Reserved
}

public class DidResponseDto
{
    public string Id { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string TenantId { get; set; } = string.Empty;
    public string TenantName { get; set; } = string.Empty;
    public string TenantSlug { get; set; } = string.Empty;
    public string RoutingStrategy { get; set; } = "Round-Robin";
    public string QueueName { get; set; } = "Inbound Sales Queue";
    public bool EnableRecording { get; set; }
    public bool EnableAiWhisper { get; set; }
    public string Status { get; set; } = "Online";
    public int ChannelsCount { get; set; }
    public string? Notes { get; set; }
    public DateTime AllocatedAt { get; set; }
}
