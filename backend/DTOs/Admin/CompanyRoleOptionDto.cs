namespace backend.DTOs.Admin;

public sealed class CompanyRoleOptionDto
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public bool IsAssignable { get; set; }
}
