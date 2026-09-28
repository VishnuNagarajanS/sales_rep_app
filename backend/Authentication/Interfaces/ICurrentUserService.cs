namespace backend.Authentication.Interfaces;

public interface ICurrentUserService
{
    int? UserId { get; }
    int? CompanyId { get; }
    string? Role { get; }
    string? Email { get; }
    bool IsAuthenticated { get; }
}
