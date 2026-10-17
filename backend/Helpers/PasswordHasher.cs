namespace backend.Helpers;

public static class PasswordHasher
{
    public static string GenerateTemporaryPassword()
    {
        var code = System.Security.Cryptography.RandomNumberGenerator.GetInt32(1000, 10000);
        return $"Nexus#{code}!";
    }

    public static string HashPassword(string password)
    {
        return BCrypt.Net.BCrypt.HashPassword(password, workFactor: 11);
    }

    public static bool VerifyPassword(string password, string passwordHash)
    {
        try
        {
            return BCrypt.Net.BCrypt.Verify(password, passwordHash);
        }
        catch
        {
            return false;
        }
    }
}

