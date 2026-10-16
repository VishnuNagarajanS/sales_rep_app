using System.Security.Cryptography;
using System.Text;
using backend.Services.Interfaces;
using Microsoft.Extensions.Configuration;

namespace backend.Services.Implementations;

public class MfaEncryptionService : IMfaEncryptionService
{
    private readonly byte[] _key;

    public MfaEncryptionService(IConfiguration configuration)
    {
        // 1. Check for dedicated MFA encryption key in config or environment
        var rawKey = configuration["MfaSettings:EncryptionKey"] ?? configuration["MFA_ENCRYPTION_KEY"];

        if (!string.IsNullOrWhiteSpace(rawKey))
        {
            if (rawKey.Length == 44 && Convert.TryFromBase64String(rawKey, new Span<byte>(new byte[32]), out _))
            {
                _key = Convert.FromBase64String(rawKey);
            }
            else
            {
                _key = SHA256.HashData(Encoding.UTF8.GetBytes(rawKey));
            }
        }
        else
        {
            // 2. Derive deterministic 256-bit key from JwtSettings:SecretKey using HKDF-SHA256
            var jwtKey = configuration["JwtSettings:SecretKey"];
            var masterSecret = !string.IsNullOrWhiteSpace(jwtKey)
                ? jwtKey
                : "nexus-sales-secure-totp-production-fallback-key-2026";

            var ikm = Encoding.UTF8.GetBytes(masterSecret);
            var salt = Encoding.UTF8.GetBytes("nexus-totp-mfa-encryption-salt-v1");
            var info = Encoding.UTF8.GetBytes("NexusSales.MfaSecretKeyDerivation");

            _key = HKDF.DeriveKey(HashAlgorithmName.SHA256, ikm, 32, salt, info);
        }
    }

    public string EncryptSecret(string plaintextSecret)
    {
        if (string.IsNullOrEmpty(plaintextSecret))
            return string.Empty;

        var plaintextBytes = Encoding.UTF8.GetBytes(plaintextSecret);
        var nonce = new byte[AesGcm.NonceByteSizes.MaxSize]; // 12 bytes
        RandomNumberGenerator.Fill(nonce);

        var ciphertext = new byte[plaintextBytes.Length];
        var tag = new byte[AesGcm.TagByteSizes.MaxSize]; // 16 bytes

        using var aes = new AesGcm(_key, AesGcm.TagByteSizes.MaxSize);
        aes.Encrypt(nonce, plaintextBytes, ciphertext, tag);

        // Binary payload format: [Nonce (12 bytes)][Tag (16 bytes)][Ciphertext]
        var combined = new byte[nonce.Length + tag.Length + ciphertext.Length];
        Buffer.BlockCopy(nonce, 0, combined, 0, nonce.Length);
        Buffer.BlockCopy(tag, 0, combined, nonce.Length, tag.Length);
        Buffer.BlockCopy(ciphertext, 0, combined, nonce.Length + tag.Length, ciphertext.Length);

        return Convert.ToBase64String(combined);
    }

    public string DecryptSecret(string encryptedSecret)
    {
        if (string.IsNullOrEmpty(encryptedSecret))
            return string.Empty;

        var combined = Convert.FromBase64String(encryptedSecret);
        var nonceSize = AesGcm.NonceByteSizes.MaxSize; // 12 bytes
        var tagSize = AesGcm.TagByteSizes.MaxSize;     // 16 bytes

        if (combined.Length < nonceSize + tagSize)
            throw new CryptographicException("Encrypted secret payload is too short or corrupted.");

        var nonce = combined[..nonceSize];
        var tag = combined[nonceSize..(nonceSize + tagSize)];
        var ciphertext = combined[(nonceSize + tagSize)..];

        var plaintextBytes = new byte[ciphertext.Length];
        using var aes = new AesGcm(_key, tagSize);
        aes.Decrypt(nonce, ciphertext, tag, plaintextBytes);

        return Encoding.UTF8.GetString(plaintextBytes);
    }
}
