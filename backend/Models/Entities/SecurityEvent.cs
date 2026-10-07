using System.ComponentModel.DataAnnotations.Schema;

namespace backend.Models.Entities;

public class SecurityEvent
{
    public int Id { get; set; }

    public int? UserId { get; set; }
    public User? User { get; set; }

    public string EventType { get; set; } = string.Empty;
    public string ActorEmail { get; set; } = string.Empty;
    public string IpAddress { get; set; } = string.Empty;
    public string UserAgent { get; set; } = string.Empty;
    public string Details { get; set; } = string.Empty;
    public string Severity { get; set; } = "info"; // info | warning | critical

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Property mappings for DTO / service compatibility
    [NotMapped]
    public string Description
    {
        get => Details;
        set => Details = value;
    }

    [NotMapped]
    public string? UserEmail
    {
        get => ActorEmail;
        set => ActorEmail = value ?? string.Empty;
    }

    [NotMapped]
    public DateTime Timestamp
    {
        get => CreatedAt;
        set => CreatedAt = value;
    }
}
