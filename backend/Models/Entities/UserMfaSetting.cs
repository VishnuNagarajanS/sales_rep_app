namespace backend.Models.Entities;

public class UserMfaSetting
{
    public int Id { get; set; }

    public int UserId { get; set; }
    public User User { get; set; } = null!;

    public bool IsEnabled { get; set; } = false;

    /// <summary>
    /// Authenticated AES-256-GCM encrypted Base32 TOTP secret key.
    /// Never stored or logged in plaintext.
    /// </summary>
    public string SecretEncrypted { get; set; } = string.Empty;

    /// <summary>
    /// Pending encrypted secret staged during enrollment before code verification.
    /// Cleared once verified and activated.
    /// </summary>
    public string? PendingSecretEncrypted { get; set; }

    public DateTime? EnabledAt { get; set; }
    public DateTime? LastUsedAt { get; set; }

    public int FailedAttempts { get; set; } = 0;
    public DateTime? LockedUntil { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
