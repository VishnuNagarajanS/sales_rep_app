using System.Text.Json;
using System.Text.Json.Nodes;
using backend.Data;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Ai.Tools
{
    public class SearchCallsTool : AiTool
    {
        public override string Name => "search_calls";
        public override string Description => "Search for call records made in the system.";
        
        public override JsonObject Parameters => JsonNode.Parse(@"
        {
            ""type"": ""object"",
            ""properties"": {
                ""dateFrom"": { ""type"": ""string"", ""description"": ""Start date (YYYY-MM-DD)"" },
                ""dateTo"": { ""type"": ""string"", ""description"": ""End date (YYYY-MM-DD)"" },
                ""agentName"": { ""type"": ""string"", ""description"": ""Search calls made by an agent"" },
                ""contactNumber"": { ""type"": ""string"", ""description"": ""Search calls by contact phone number"" }
            }
        }")!.AsObject();

        private class Args
        {
            public string? DateFrom { get; set; }
            public string? DateTo { get; set; }
            public string? AgentName { get; set; }
            public string? ContactNumber { get; set; }
        }

        public override async Task<string> ExecuteAsync(string arguments, AiDataScope scope, IServiceProvider services, CancellationToken ct)
        {
            var args = ParseArgs<Args>(arguments) ?? new Args();
            var aiSettings = services.GetRequiredService<Microsoft.Extensions.Options.IOptionsSnapshot<AiSettings>>().Value;
            var limit = aiSettings.MaxRowsPerTool > 0 ? aiSettings.MaxRowsPerTool : 25;
            var includeContact = aiSettings.IncludeContactDetails;
            
            var db = services.GetRequiredService<ApplicationDbContext>();

            var query = db.CallRecords.AsNoTracking().Where(c => c.CompanyId == scope.CompanyId);

            if (!string.IsNullOrEmpty(args.DateFrom) || !string.IsNullOrEmpty(args.DateTo))
            {
                var clock = services.GetRequiredService<backend.Services.Interfaces.ICompanyClock>();
                var tz = await clock.GetTimeZoneAsync(scope.CompanyId, ct);
                var (from, to) = AiDateResolver.ResolveDateRange(args.DateFrom, args.DateTo, tz);
                query = query.Where(c => c.Timestamp >= from && c.Timestamp <= to);
            }

            if (!string.IsNullOrEmpty(args.AgentName))
            {
                var search = args.AgentName.ToLower();
                query = query.Where(c => c.Agent != null && c.Agent.Name.ToLower().Contains(search));
            }

            if (!string.IsNullOrEmpty(args.ContactNumber))
            {
                query = query.Where(c => c.ContactPhone.Contains(args.ContactNumber));
            }

            var totalCount = await query.CountAsync(ct);
            var results = await query.OrderByDescending(c => c.Timestamp).Take(limit).Select(c => new
            {
                c.Id,
                c.Direction,
                c.Disposition,
                c.ContactPhone,
                c.DurationSeconds,
                AgentName = c.Agent != null ? c.Agent.Name : null,
                StartedAt = c.Timestamp.ToString("yyyy-MM-dd HH:mm:ss")
            }).ToListAsync(ct);

            return JsonSerializer.Serialize(new { totalCount, results });
        }
    }
}
