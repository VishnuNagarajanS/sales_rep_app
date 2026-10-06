namespace backend.DTOs.Auth;

public class UserDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public RoleDto Role { get; set; } = null!;
    public string? CompanyId { get; set; }
    public string? CompanySlug { get; set; }
    public string? CompanyName { get; set; }
    public string Status { get; set; } = "Active";
    public string? LastLogin { get; set; }
    public string? Avatar { get; set; }
    public bool MustChangePassword { get; set; }
}
