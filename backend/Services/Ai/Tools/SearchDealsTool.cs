using System.Text.Json;
using System.Text.Json.Nodes;
using backend.Data;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Ai.Tools
{
    public class SearchDealsTool : AiTool
    {
        public override string Name => "search_deals";
        public override string Description => "Search deals and customers in the sales pipeline.";
        
        public override JsonObject Parameters => JsonNode.Parse(@"
        {
            ""type"": ""object"",
            ""properties"": {
                ""stage"": { ""type"": ""string"", ""description"": ""Pipeline stage (e.g., new, contacted, converted, lost)"" },
                ""customerName"": { ""type"": ""string"", ""description"": ""Search by customer name or title"" }
            }
        }")!.AsObject();

        private class Args
        {
            public string? Stage { get; set; }
            public string? CustomerName { get; set; }
        }

        public override async Task<string> ExecuteAsync(string arguments, AiDataScope scope, IServiceProvider services, CancellationToken ct)
        {
            var args = ParseArgs<Args>(arguments) ?? new Args();
            var aiSettings = services.GetRequiredService<Microsoft.Extensions.Options.IOptionsSnapshot<AiSettings>>().Value;
            var limit = aiSettings.MaxRowsPerTool > 0 ? aiSettings.MaxRowsPerTool : 25;
            var includeContact = aiSettings.IncludeContactDetails;
            
            var db = services.GetRequiredService<ApplicationDbContext>();

            var query = db.GhlDeals.AsNoTracking().Where(d => d.CompanyId == scope.CompanyId);

            if (!string.IsNullOrEmpty(args.Stage))
            {
                query = query.Where(d => d.Stage == args.Stage);
            }

            if (!string.IsNullOrEmpty(args.CustomerName))
            {
                var search = args.CustomerName.ToLower();
                query = query.Where(d => d.CustomerName.ToLower().Contains(search) || d.Title.ToLower().Contains(search));
            }

            var totalCount = await query.CountAsync(ct);
            var results = await query.OrderByDescending(d => d.CreatedAt).Take(limit).Select(d => new
            {
                d.Id,
                d.Title,
                d.CustomerName,
                d.Stage,
                d.Value,
                d.ExpectedCloseDate,
                d.Notes,
                d.LostReason,
                d.InvestmentRange,
                d.PreferredAssetClass,
                d.Priority,
                d.InvestmentAmountConfirmed,
                d.KycStatus,
                CreatedAt = d.CreatedAt.ToString("yyyy-MM-dd"),
                AssignedTo = d.AssignedAgent != null ? d.AssignedAgent.Name : null
            }).ToListAsync(ct);

            return JsonSerializer.Serialize(new { totalCount, results });
        }
    }
}
