namespace backend.Services.Interfaces;

public interface IMfaEncryptionService
{
    /// <summary>
    /// Encrypts sensitive MFA data (such as Base32 TOTP secret keys) at rest using AES-256-GCM.
    /// </summary>
    string EncryptSecret(string plaintextSecret);

    /// <summary>
    /// Decrypts AES-256-GCM encrypted MFA secrets. Throws CryptographicException if corrupted or tampered.
    /// </summary>
    string DecryptSecret(string encryptedSecret);
}
