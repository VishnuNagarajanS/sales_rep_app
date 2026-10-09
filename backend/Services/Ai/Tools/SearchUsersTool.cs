using System.Text.Json;
using System.Text.Json.Nodes;
using backend.Data;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Ai.Tools
{
    public class SearchUsersTool : AiTool
    {
        public override string Name => "search_users";
        public override string Description => "Search for team members (users) in the company to find their roles, contact details, or active status.";
        
        public override JsonObject Parameters => JsonNode.Parse(@"
        {
            ""type"": ""object"",
            ""properties"": {
                ""roleCode"": { ""type"": ""string"", ""description"": ""Role code (e.g., sales_executive, irm, company_admin)"" },
                ""name"": { ""type"": ""string"", ""description"": ""Search by user name"" }
            }
        }")!.AsObject();

        private class Args
        {
            public string? RoleCode { get; set; }
            public string? Name { get; set; }
        }

        public override async Task<string> ExecuteAsync(string arguments, AiDataScope scope, IServiceProvider services, CancellationToken ct)
        {
            var args = ParseArgs<Args>(arguments) ?? new Args();
            var aiSettings = services.GetRequiredService<Microsoft.Extensions.Options.IOptionsSnapshot<AiSettings>>().Value;
            var limit = aiSettings.MaxRowsPerTool > 0 ? aiSettings.MaxRowsPerTool : 25;
            var includeContact = aiSettings.IncludeContactDetails;
            
            var db = services.GetRequiredService<ApplicationDbContext>();

            var query = db.Users.Include(u => u.Role).AsNoTracking().Where(u => u.CompanyId == scope.CompanyId);

            if (!string.IsNullOrEmpty(args.RoleCode))
            {
                query = query.Where(u => u.Role != null && u.Role.Code == args.RoleCode);
            }

            if (!string.IsNullOrEmpty(args.Name))
            {
                var search = args.Name.ToLower();
                query = query.Where(u => u.Name.ToLower().Contains(search));
            }

            var totalCount = await query.CountAsync(ct);
            var results = await query.OrderBy(u => u.Name).Take(limit).Select(u => new
            {
                u.Id,
                u.Name,
                Email = includeContact ? u.Email : "[REDACTED]",
                Role = u.Role != null ? u.Role.Name : null,
                u.Status,
                Phone = includeContact ? u.Phone : "[REDACTED]",
                LastActive = u.LastLoginAt
            }).ToListAsync(ct);

            return JsonSerializer.Serialize(new { totalCount, results });
        }
    }
}
