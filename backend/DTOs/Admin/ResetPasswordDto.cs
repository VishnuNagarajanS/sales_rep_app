namespace backend.DTOs.Admin;

public class AdminResetPasswordRequestDto
{
    public string? NewPassword { get; set; }
}

public class ResetPasswordResponseDto
{
    public int UserId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string TempPassword { get; set; } = string.Empty;
}
