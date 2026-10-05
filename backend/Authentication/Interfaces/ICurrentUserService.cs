namespace backend.Authentication.Interfaces;

public interface ICurrentUserService
{
    int? UserId { get; }
    int? CompanyId { get; }
    string? Role { get; }
    string? Email { get; }
    string? Name { get; }
    bool IsAuthenticated { get; }
}
