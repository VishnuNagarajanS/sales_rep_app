using backend.Authentication.Interfaces;

namespace backend.Services.Ai
{
    public class AiDataScope
    {
        public int CompanyId { get; }
        public int UserId { get; }
        public string RoleCode { get; }

        public bool IsAdmin => RoleCode == "company_admin" || RoleCode == "super_admin" || RoleCode == "admin" || RoleCode == "ghl_admin";
        public bool IsSalesExecutive => RoleCode == "sales_executive";
        public bool IsIrm => RoleCode == "irm";

        public AiDataScope(ICurrentUserService currentUserService)
        {
            if (!currentUserService.CompanyId.HasValue || !currentUserService.UserId.HasValue || string.IsNullOrEmpty(currentUserService.Role))
            {
                throw new UnauthorizedAccessException("Invalid user context for AI assistant.");
            }

            CompanyId = currentUserService.CompanyId.Value;
            UserId = currentUserService.UserId.Value;
            RoleCode = (currentUserService.Role ?? "").ToLowerInvariant();

            var allowedRoles = new HashSet<string> { "company_admin", "sales_executive", "irm", "super_admin", "admin", "ghl_admin" };
            if (!allowedRoles.Contains(RoleCode))
            {
                throw new UnauthorizedAccessException("Currently, Nexus AI is only available for authorized sales, IRM, and administrative roles.");
            }
        }
    }
}
