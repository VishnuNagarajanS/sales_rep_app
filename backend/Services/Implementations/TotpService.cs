using System.Buffers.Binary;
using System.Security.Cryptography;
using System.Text;
using backend.Services.Interfaces;

namespace backend.Services.Implementations;

public class TotpService : ITotpService
{
    private const int TimeStepSeconds = 30;
    private const int CodeDigits = 6;
    private static readonly char[] Base32Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".ToCharArray();

    public string GenerateSecret()
    {
        var bytes = new byte[20];
        RandomNumberGenerator.Fill(bytes);
        return ToBase32String(bytes);
    }

    public string GenerateQrCodeUri(string email, string secret, string issuer = "NexusSales Platform")
    {
        var encodedIssuer = Uri.EscapeDataString(issuer);
        var encodedEmail = Uri.EscapeDataString(email);
        return $"otpauth://totp/{encodedIssuer}:{encodedEmail}?secret={secret}&issuer={encodedIssuer}&algorithm=SHA1&digits={CodeDigits}&period={TimeStepSeconds}";
    }

    public bool VerifyCode(string secret, string code)
    {
        if (string.IsNullOrWhiteSpace(secret) || string.IsNullOrWhiteSpace(code))
            return false;

        var cleanCode = code.Trim().Replace(" ", "").Replace("-", "");
        if (cleanCode.Length != CodeDigits || !int.TryParse(cleanCode, out var parsedCode))
            return false;

        byte[] secretBytes;
        try
        {
            secretBytes = FromBase32String(secret);
        }
        catch
        {
            return false;
        }

        var currentStep = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / TimeStepSeconds;

        // Allow 1 step backward and 1 step forward (clock drift window of +-30s)
        for (var step = currentStep - 1; step <= currentStep + 1; step++)
        {
            if (ComputeTotpCode(secretBytes, step) == parsedCode)
            {
                return true;
            }
        }

        return false;
    }

    public bool ValidateTotp(string secret, string code) => VerifyCode(secret, code);

    public List<string> GenerateRecoveryCodes(int count = 8)
    {
        var codes = new List<string>(count);
        for (var i = 0; i < count; i++)
        {
            var bytes = new byte[4];
            RandomNumberGenerator.Fill(bytes);
            var hex = Convert.ToHexString(bytes).ToUpperInvariant();
            codes.Add($"{hex[..4]}-{hex[4..]}");
        }
        return codes;
    }

    public string HashRecoveryCode(string code)
    {
        var clean = code.Trim().Replace("-", "").ToUpperInvariant();
        using var sha = SHA256.Create();
        var hash = sha.ComputeHash(Encoding.UTF8.GetBytes(clean));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    public bool VerifyAndConsumeRecoveryCode(string plainCode, List<string> hashedCodes, out List<string> remainingHashedCodes)
    {
        remainingHashedCodes = new List<string>(hashedCodes);
        if (string.IsNullOrWhiteSpace(plainCode) || hashedCodes == null || hashedCodes.Count == 0)
            return false;

        var targetHash = HashRecoveryCode(plainCode);
        for (var i = 0; i < remainingHashedCodes.Count; i++)
        {
            if (string.Equals(remainingHashedCodes[i], targetHash, StringComparison.OrdinalIgnoreCase))
            {
                remainingHashedCodes.RemoveAt(i);
                return true;
            }
        }

        return false;
    }

    private static int ComputeTotpCode(byte[] key, long step)
    {
        Span<byte> counter = stackalloc byte[8];
        BinaryPrimitives.WriteInt64BigEndian(counter, step);

        using var hmac = new HMACSHA1(key);
        Span<byte> hash = stackalloc byte[20];
        hmac.TryComputeHash(counter, hash, out _);

        var offset = hash[19] & 0x0F;
        var binaryCode =
            ((hash[offset] & 0x7F) << 24) |
            ((hash[offset + 1] & 0xFF) << 16) |
            ((hash[offset + 2] & 0xFF) << 8) |
            (hash[offset + 3] & 0xFF);

        return binaryCode % 1_000_000;
    }

    private static string ToBase32String(byte[] bytes)
    {
        var result = new StringBuilder((bytes.Length * 8 + 4) / 5);
        int buffer = 0;
        int bitsLeft = 0;

        foreach (var b in bytes)
        {
            buffer = (buffer << 8) | b;
            bitsLeft += 8;
            while (bitsLeft >= 5)
            {
                bitsLeft -= 5;
                result.Append(Base32Chars[(buffer >> bitsLeft) & 31]);
            }
        }

        if (bitsLeft > 0)
        {
            result.Append(Base32Chars[(buffer << (5 - bitsLeft)) & 31]);
        }

        return result.ToString();
    }

    private static byte[] FromBase32String(string base32)
    {
        var clean = base32.Trim().ToUpperInvariant().Replace(" ", "").Replace("=", "");
        var output = new List<byte>((clean.Length * 5) / 8);
        int buffer = 0;
        int bitsLeft = 0;

        foreach (var c in clean)
        {
            var val = Array.IndexOf(Base32Chars, c);
            if (val < 0)
                throw new ArgumentException($"Invalid Base32 character: {c}");

            buffer = (buffer << 5) | val;
            bitsLeft += 5;
            if (bitsLeft >= 8)
            {
                bitsLeft -= 8;
                output.Add((byte)((buffer >> bitsLeft) & 0xFF));
            }
        }

        return output.ToArray();
    }
}
