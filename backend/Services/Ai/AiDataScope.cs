using backend.Authentication.Interfaces;

namespace backend.Services.Ai
{
    public class AiDataScope
    {
        public int CompanyId { get; }
        public int UserId { get; }
        public string RoleCode { get; }

        public AiDataScope(ICurrentUserService currentUserService)
        {
            if (!currentUserService.CompanyId.HasValue || !currentUserService.UserId.HasValue || string.IsNullOrEmpty(currentUserService.Role))
            {
                throw new UnauthorizedAccessException("Invalid user context for AI assistant.");
            }

            CompanyId = currentUserService.CompanyId.Value;
            UserId = currentUserService.UserId.Value;
            RoleCode = currentUserService.Role;
            
            // Temporary check: ensure only company_admin is allowed
            if (RoleCode != "company_admin")
            {
                throw new UnauthorizedAccessException("Currently, Nexus AI is only available for company admins.");
            }
        }
    }
}
