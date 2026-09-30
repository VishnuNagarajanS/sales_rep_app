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
        var isSuperAdmin = user.IsInRole("super_admin");
        var companyClaim = user.FindFirst("company_id")?.Value;
        if (!isSuperAdmin && (!int.TryParse(companyClaim, out var companyId) || companyId != 2))
        {
            context.Result = new ForbidResult();
            return;
        }
        base.OnActionExecuting(context);
    }
}
