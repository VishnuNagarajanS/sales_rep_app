namespace backend.Services.Interfaces;

public interface ICurrentUserService
{
    int UserId { get; }
    int CompanyId { get; }
    string RoleCode { get; }
    string Role { get; }
    bool IsAuthenticated { get; }
}
