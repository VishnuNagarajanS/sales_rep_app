namespace backend.Models.Entities;

public class MfaRecoveryCode
{
    public int Id { get; set; }

    public int UserId { get; set; }
    public User User { get; set; } = null!;

    /// <summary>
    /// Cryptographic SHA-256 hash of the normalized recovery code.
    /// Plaintext is never stored in the database.
    /// </summary>
    public string CodeHash { get; set; } = string.Empty;

    /// <summary>
    /// Timestamp when this recovery code was consumed. Null if unused.
    /// Used codes cannot be reused.
    /// </summary>
    public DateTime? UsedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
