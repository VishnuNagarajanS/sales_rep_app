namespace backend.Services.Interfaces;

public interface ICurrentUserService
{
    int UserId { get; }
    int CompanyId { get; }
    string RoleCode { get; }
    bool IsAuthenticated { get; }
}
