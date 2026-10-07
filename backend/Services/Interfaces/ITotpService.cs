namespace backend.Services.Interfaces;

public interface ITotpService
{
    /// <summary>Generates a cryptographically secure 20-byte Base32 secret string.</summary>
    string GenerateSecret();

    /// <summary>Formats standard otpauth:// URL for authenticator applications.</summary>
    string GenerateQrCodeUri(string email, string secret, string issuer = "NexusSales Platform");

    /// <summary>Validates a 6-digit TOTP code against the secret with a 30s clock drift window.</summary>
    bool VerifyCode(string secret, string code);

    /// <summary>Alias for VerifyCode.</summary>
    bool ValidateTotp(string secret, string code);

    /// <summary>Generates a list of random one-time recovery codes in format XXXX-XXXX.</summary>
    List<string> GenerateRecoveryCodes(int count = 8);

    /// <summary>Hashes a recovery code for secure database persistence.</summary>
    string HashRecoveryCode(string code);

    /// <summary>Verifies a plain recovery code against stored hashed codes and consumes it if valid.</summary>
    bool VerifyAndConsumeRecoveryCode(string plainCode, List<string> hashedCodes, out List<string> remainingHashedCodes);
}
