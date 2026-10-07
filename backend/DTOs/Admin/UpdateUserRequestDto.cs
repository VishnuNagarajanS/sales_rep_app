using backend.Models.Enums;

namespace backend.DTOs.Admin;

public class UpdateUserRequestDto
{
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public int RoleId { get; set; }
    public UserStatus Status { get; set; }
}
