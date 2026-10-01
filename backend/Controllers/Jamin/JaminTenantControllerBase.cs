using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace backend.Controllers.Jamin;

/// <summary>Restricts Jamin-specific endpoints to the Jamin tenant, including platform admins.</summary>
[JaminTenantFilter]
public abstract class JaminTenantControllerBase : ControllerBase
{
    protected const int JaminCompanyId = 2;
}

/// <summary>Action filter that enforces Jamin tenant scoping.</summary>
public class JaminTenantFilterAttribute : ActionFilterAttribute
{
    public override void OnActionExecuting(ActionExecutingContext context)
    {
        var user = context.HttpContext.User;
        if (user.Identity == null || !user.Identity.IsAuthenticated)
        {
            base.OnActionExecuting(context);
            return;
        }

        var isSuperAdmin = user.IsInRole("super_admin") || user.IsInRole("SuperAdmin");
        var companyClaim = user.FindFirst("company_id")?.Value
                        ?? user.FindFirst("companyId")?.Value
                        ?? user.FindFirst("tenant_id")?.Value;

        if (!isSuperAdmin && int.TryParse(companyClaim, out var companyId) && companyId != 2 && companyId != 0)
        {
            context.Result = new ForbidResult();
            return;
        }

        base.OnActionExecuting(context);
    }
}
