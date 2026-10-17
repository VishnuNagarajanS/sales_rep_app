using System.Text.Json;
using System.Text.Json.Nodes;
using backend.Data;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Ai.Tools
{
    public class SearchCustomersTool : AiTool
    {
        public override string Name => "search_customers";
        public override string Description => "Search for customers in the system.";
        
        public override JsonObject Parameters => JsonNode.Parse(@"
        {
            ""type"": ""object"",
            ""properties"": {
                ""name"": { ""type"": ""string"", ""description"": ""Search by customer name"" },
                ""status"": { ""type"": ""string"", ""description"": ""Search by customer status"" }
            }
        }")!.AsObject();

        private class Args
        {
            public string? Name { get; set; }
            public string? Status { get; set; }
        }

        public override async Task<string> ExecuteAsync(string arguments, AiDataScope scope, IServiceProvider services, CancellationToken ct)
        {
            var args = ParseArgs<Args>(arguments) ?? new Args();
            var aiSettings = services.GetRequiredService<Microsoft.Extensions.Options.IOptionsSnapshot<AiSettings>>().Value;
            var limit = aiSettings.MaxRowsPerTool > 0 ? aiSettings.MaxRowsPerTool : 25;
            var includeContact = aiSettings.IncludeContactDetails;
            
            var db = services.GetRequiredService<ApplicationDbContext>();

            var query = db.Customers.AsNoTracking().Where(c => c.CompanyId == scope.CompanyId);

            if (!string.IsNullOrEmpty(args.Status))
            {
                query = query.Where(c => c.Status == args.Status);
            }

            if (!string.IsNullOrEmpty(args.Name))
            {
                var search = args.Name.ToLower();
                query = query.Where(c => c.Name.ToLower().Contains(search) || (c.Notes != null && c.Notes.ToLower().Contains(search)));
            }

            var totalCount = await query.CountAsync(ct);
            var results = await query.OrderByDescending(c => c.CreatedAt).Take(limit).Select(c => new
            {
                c.Id,
                c.Name,
                Email = includeContact ? c.Email : "[REDACTED]",
                Phone = includeContact ? c.Phone : "[REDACTED]",
                c.Status,
                c.Location,
                c.TotalValue,
                CreatedAt = c.CreatedAt.ToString("yyyy-MM-dd"),
                AssignedTo = c.AssignedAgent != null ? c.AssignedAgent.Name : null
            }).ToListAsync(ct);

            return JsonSerializer.Serialize(new { totalCount, results });
        }
    }
}
