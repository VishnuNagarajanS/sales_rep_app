namespace backend.DTOs.Auth;

public class LoginResponseDto
{
    public string Token { get; set; } = string.Empty;
    public UserDto? User { get; set; }
    public TenantDto? Tenant { get; set; }
    public bool RequiresTwoFactor { get; set; }
    public string? TempToken { get; set; }
    public bool MustEnrollTwoFactor { get; set; }
    public bool MustChangePassword { get; set; }
}
