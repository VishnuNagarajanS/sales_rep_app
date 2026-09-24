using System.Security.Claims;
using backend.Services.Interfaces;

namespace backend.Services.Implementations;

public sealed class CurrentUserService(IHttpContextAccessor httpContextAccessor) : ICurrentUserService
{
    public int UserId => ParseClaim(ClaimTypes.NameIdentifier, "userId");
    public int CompanyId => ParseClaim("company_id", "companyId");
    public string RoleCode => httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.Role)?.Value ?? string.Empty;
    public bool IsAuthenticated => UserId > 0 && CompanyId > 0;

    private int ParseClaim(params string[] claimTypes)
    {
        var user = httpContextAccessor.HttpContext?.User;
        foreach (var type in claimTypes)
        {
            var value = user?.FindFirst(type)?.Value;
            if (int.TryParse(value, out var result)) return result;
        }
        return 0;
    }
}
