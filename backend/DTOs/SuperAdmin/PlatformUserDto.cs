namespace backend.DTOs.SuperAdmin;

public class PlatformRoleDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsSystemRole { get; set; }
    public bool IsActive { get; set; } = true;
    public List<string> Permissions { get; set; } = new();
    public int PermissionsCount => Permissions?.Count ?? 0;
    public int UsersCount { get; set; }
    public string? CreatedBy { get; set; }
    public string CreatedAt { get; set; } = string.Empty;
    public string? UpdatedAt { get; set; }
}

public class CreateRoleRequestDto
{
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public List<string> Permissions { get; set; } = new();
}

public class UpdateRoleRequestDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool? IsActive { get; set; }
    public List<string>? Permissions { get; set; }
}

public class UpdateRoleStatusDto
{
    public bool IsActive { get; set; }
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

public class PermissionItemDto
{
    public string Key { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string? Description { get; set; }
}

public class PermissionGroupDto
{
    public string Group { get; set; } = string.Empty;
    public List<PermissionItemDto> Items { get; set; } = new();
}
