using System.Security.Claims;
using backend.Authentication.Interfaces;

namespace backend.Authentication.Implementations;

public class CurrentUserService : ICurrentUserService
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public CurrentUserService(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    private ClaimsPrincipal? User => _httpContextAccessor.HttpContext?.User;

    public bool IsAuthenticated => User?.Identity?.IsAuthenticated ?? false;

    public int? UserId
    {
        get
        {
            var idClaim = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value
                          ?? User?.FindFirst("sub")?.Value;
            return int.TryParse(idClaim, out var id) ? id : null;
        }
    }

    public int? CompanyId
    {
        get
        {
            var compClaim = User?.FindFirst("company_id")?.Value;
            return int.TryParse(compClaim, out var id) ? id : null;
        }
    }

    public string? Role => User?.FindFirst(ClaimTypes.Role)?.Value;

    public string? Email => User?.FindFirst(ClaimTypes.Email)?.Value;
}
