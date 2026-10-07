using System.Text.Json;
using System.Text.Json.Nodes;
using backend.Data;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Ai.Tools
{
    public class SearchConsultationsTool : AiTool
    {
        public override string Name => "search_consultations";
        public override string Description => "Search for client or investor consultations scheduled in the system.";
        
        public override JsonObject Parameters => JsonNode.Parse(@"
        {
            ""type"": ""object"",
            ""properties"": {
                ""dateFrom"": { ""type"": ""string"", ""description"": ""Start date (YYYY-MM-DD)"" },
                ""dateTo"": { ""type"": ""string"", ""description"": ""End date (YYYY-MM-DD)"" },
                ""status"": { ""type"": ""string"", ""description"": ""Status (e.g., Scheduled, Completed, Cancelled)"" }
            }
        }")!.AsObject();

        private class Args
        {
            public string? DateFrom { get; set; }
            public string? DateTo { get; set; }
            public string? Status { get; set; }
        }

        public override async Task<string> ExecuteAsync(string arguments, AiDataScope scope, IServiceProvider services, CancellationToken ct)
        {
            var args = ParseArgs<Args>(arguments) ?? new Args();
            var db = services.GetRequiredService<ApplicationDbContext>();

            var query = db.Consultations.AsNoTracking().Where(c => c.CompanyId == scope.CompanyId);

            if (!string.IsNullOrEmpty(args.DateFrom) || !string.IsNullOrEmpty(args.DateTo))
            {
                var (from, to) = AiDateResolver.ResolveDateRange(args.DateFrom, args.DateTo);
                query = query.Where(c => c.ScheduledAt >= from && c.ScheduledAt <= to);
            }

            if (!string.IsNullOrEmpty(args.Status))
            {
                if (Enum.TryParse<backend.Models.Enums.ConsultationStatus>(args.Status, true, out var parsedStatus))
                {
                    query = query.Where(c => c.Status == parsedStatus);
                }
            }

            var totalCount = await query.CountAsync(ct);
            var results = await query.OrderByDescending(c => c.ScheduledAt).Take(25).Select(c => new
            {
                c.Id,
                Title = c.Agenda,
                Status = c.Status.ToString(),
                ScheduledAt = c.ScheduledAt.ToString("yyyy-MM-dd HH:mm"),
                Host = c.ConsultantName,
                c.InvestorName,
                c.InvestorPhone,
                c.OutcomeNotes,
                c.ReferredByAgentName,
                CreatedAt = c.CreatedAt.ToString("yyyy-MM-dd")
            }).ToListAsync(ct);

            return JsonSerializer.Serialize(new { totalCount, results });
        }
    }
}
