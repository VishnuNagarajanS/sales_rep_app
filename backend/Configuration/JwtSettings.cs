namespace backend.Configuration;

public class JwtSettings
{
    public const string SectionName = "JwtSettings";

    public string SecretKey { get; set; } = string.Empty;
    public string Issuer { get; set; } = "NexusSalesApi";
    public string Audience { get; set; } = "NexusSalesClient";
    public int ExpirationMinutes { get; set; } = 1440;
}
