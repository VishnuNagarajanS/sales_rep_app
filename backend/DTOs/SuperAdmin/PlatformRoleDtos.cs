namespace backend.DTOs.SuperAdmin;

public class UpdateRolePermissionsDto
{
    public List<string> Permissions { get; set; } = new();
}

public class CreateCustomRoleDto
{
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? BaseTemplateRole { get; set; }
    public List<string> Permissions { get; set; } = new();
}
