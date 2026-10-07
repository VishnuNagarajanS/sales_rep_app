using System.Security.Claims;

namespace backend.Extensions;

public static class ClaimsPrincipalExtensions
{
    public static int GetUserId(this ClaimsPrincipal principal)
    {
        var idClaim = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value
                      ?? principal.FindFirst("sub")?.Value;

        return int.TryParse(idClaim, out var id) ? id : 0;
    }

    public static int GetCompanyId(this ClaimsPrincipal principal, int fallbackCompanyId = 1)
    {
        var companyClaim = principal.FindFirst("company_id")?.Value;
        return int.TryParse(companyClaim, out var id) ? id : fallbackCompanyId;
    }

    public static string GetUserRole(this ClaimsPrincipal principal)
    {
        return principal.FindFirst(ClaimTypes.Role)?.Value ?? string.Empty;
    }

    public static bool IsGhlAdmin(this ClaimsPrincipal principal)
    {
        var role = (principal.FindFirst(ClaimTypes.Role)?.Value
                    ?? principal.FindFirst("role")?.Value
                    ?? string.Empty).ToLowerInvariant();

        var companyId = principal.GetCompanyId();

        return (companyId == 1 || companyId == 0) &&
               (role == "admin" || role == "ghl_admin" || role == "company_admin" || role == "super_admin");
    }
}
