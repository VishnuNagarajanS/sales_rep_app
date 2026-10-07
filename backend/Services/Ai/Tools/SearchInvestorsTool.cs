using System.Text.Json;
using System.Text.Json.Nodes;
using backend.Data;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Ai.Tools
{
    public class SearchInvestorsTool : AiTool
    {
        public override string Name => "search_investors";
        public override string Description => "Search for investors in the system. Use this for ANY queries about investors, including 'high valued', 'AUM', capacities, or assigned agents.";
        
        public override JsonObject Parameters => JsonNode.Parse(@"
        {
            ""type"": ""object"",
            ""properties"": {
                ""name"": { ""type"": ""string"", ""description"": ""Search by investor name"" },
                ""status"": { ""type"": ""string"", ""description"": ""Search by investor status"" }
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
            var db = services.GetRequiredService<ApplicationDbContext>();

            var query = db.Investors.AsNoTracking().Where(i => i.CompanyId == scope.CompanyId);

            if (!string.IsNullOrEmpty(args.Status))
            {
                if (Enum.TryParse<backend.Models.Enums.InvestorStatus>(args.Status, true, out var parsedStatus))
                {
                    query = query.Where(i => i.Status == parsedStatus);
                }
            }

            if (!string.IsNullOrEmpty(args.Name))
            {
                var search = args.Name.ToLower();
                query = query.Where(i => i.Name.ToLower().Contains(search) || (i.Notes != null && i.Notes.ToLower().Contains(search)));
            }

            var totalCount = await query.CountAsync(ct);
            var results = await query.OrderByDescending(i => i.CreatedAt).Take(25).Select(i => new
            {
                i.Id,
                i.Name,
                i.Email,
                i.Phone,
                Status = i.Status.ToString(),
                i.InvestmentCapacity,
                i.PreferredAssetClass,
                RiskProfile = i.RiskTolerance,
                i.InvestmentMandate,
                CommittedAUM = i.CommittedAum,
                CreatedAt = i.CreatedAt.ToString("yyyy-MM-dd"),
                AssignedTo = i.AssignedIrm != null ? i.AssignedIrm.Name : null
            }).ToListAsync(ct);

            return JsonSerializer.Serialize(new { totalCount, results });
        }
    }
}
