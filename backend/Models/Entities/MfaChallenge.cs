namespace backend.Models.Entities;

public class MfaChallenge
{
    public int Id { get; set; }

    public int UserId { get; set; }
    public User User { get; set; } = null!;

    /// <summary>
    /// SHA-256 hash of the temporary challenge token returned to the client during login.
    /// Plaintext token is never persisted in the database.
    /// </summary>
    public string ChallengeTokenHash { get; set; } = string.Empty;

    public DateTime ExpiresAt { get; set; }

    public int AttemptCount { get; set; } = 0;

    /// <summary>
    /// Timestamp when this challenge was successfully verified.
    /// Once set, the challenge is consumed and replay is blocked.
    /// </summary>
    public DateTime? CompletedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
}
