namespace backend.Helpers;

public static class ContactNormalizer
{
    public static string? NormalizePhone(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone)) return null;
        var digits = new string(phone.Where(char.IsDigit).ToArray());
        if (digits.Length >= 10) return digits[^10..];
        if (digits.Length >= 7) return digits;
        return null;
    }

    public static string? NormalizeEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email)) return null;
        var clean = email.Trim().ToLowerInvariant();
        return string.IsNullOrEmpty(clean) ? null : clean;
    }
}
