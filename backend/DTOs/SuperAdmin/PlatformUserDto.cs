namespace backend.DTOs.SuperAdmin;

public class PlatformRoleDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public List<string> Permissions { get; set; } = new();
}

public class PlatformUserDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public PlatformRoleDto Role { get; set; } = new();
    public string? CompanyId { get; set; }
    public string? CompanySlug { get; set; }
    public string? CompanyName { get; set; }
    public string Status { get; set; } = "Active";
    public string? LastLogin { get; set; }
    public string? Avatar { get; set; }
    public string? EmployeeCode { get; set; }
    public string? Designation { get; set; }
    public string CreatedAt { get; set; } = string.Empty;
    public string? UpdatedAt { get; set; }
}

public class CreatePlatformUserDto
{
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Password { get; set; }
    public string RoleCode { get; set; } = string.Empty;
    public string? CompanyId { get; set; }
    public string? Designation { get; set; }
    public string? EmployeeCode { get; set; }
    public string Status { get; set; } = "Active";
}

public class UpdatePlatformUserDto
{
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? RoleCode { get; set; }
    public string? CompanyId { get; set; }
    public string? Designation { get; set; }
    public string? Status { get; set; }
}
