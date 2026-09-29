namespace backend.Models.Entities;

public class TenantDidMapping
{
    public int Id { get; set; }
    public string PhoneNumber { get; set; } = string.Empty;
    public int? TenantId { get; set; }
    public Tenant? Tenant { get; set; }
    public string RoutingStrategy { get; set; } = "Round-Robin"; // Round-Robin | Skill/Priority | Least-Busy Rep | Direct Extension
    public string QueueName { get; set; } = "Inbound Queue";
    public bool EnableRecording { get; set; } = true;
    public bool EnableAiWhisper { get; set; } = true;
    public string Status { get; set; } = "Online"; // Online | Offline | Reserved
    public int ChannelsCount { get; set; } = 8;
    public DateTime AllocatedAt { get; set; } = DateTime.UtcNow;
    public string? Notes { get; set; }
}
