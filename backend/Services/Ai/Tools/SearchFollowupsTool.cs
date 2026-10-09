using System.Text.Json;
using System.Text.Json.Nodes;
using backend.Data;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Ai.Tools
{
    public class SearchFollowupsTool : AiTool
    {
        public override string Name => "search_followups";
        public override string Description => "Search follow-up tasks and reminders. Use to answer questions about tasks, follow-ups, or things to do.";
        
        public override JsonObject Parameters => JsonNode.Parse(@"
        {
            ""type"": ""object"",
            ""properties"": {
                ""dateFrom"": { ""type"": ""string"", ""description"": ""Start date (YYYY-MM-DD)"" },
                ""dateTo"": { ""type"": ""string"", ""description"": ""End date (YYYY-MM-DD)"" },
                ""status"": { ""type"": ""string"", ""description"": ""Status (e.g., Pending, Completed)"" },
                ""contactName"": { ""type"": ""string"", ""description"": ""Search by contact or investor name"" }
            }
        }")!.AsObject();

        private class Args
        {
            public string? DateFrom { get; set; }
            public string? DateTo { get; set; }
            public string? Status { get; set; }
            public string? ContactName { get; set; }
        }

        public override async Task<string> ExecuteAsync(string arguments, AiDataScope scope, IServiceProvider services, CancellationToken ct)
        {
            var args = ParseArgs<Args>(arguments) ?? new Args();
            var aiSettings = services.GetRequiredService<Microsoft.Extensions.Options.IOptionsSnapshot<AiSettings>>().Value;
            var limit = aiSettings.MaxRowsPerTool > 0 ? aiSettings.MaxRowsPerTool : 25;
            var includeContact = aiSettings.IncludeContactDetails;
            
            var db = services.GetRequiredService<ApplicationDbContext>();

            var query = db.Followups.AsNoTracking().Where(f => f.CompanyId == scope.CompanyId);

            if (!string.IsNullOrEmpty(args.DateFrom) || !string.IsNullOrEmpty(args.DateTo))
            {
                var clock = services.GetRequiredService<backend.Services.Interfaces.ICompanyClock>();
                var tz = await clock.GetTimeZoneAsync(scope.CompanyId, ct);
                var (from, to) = AiDateResolver.ResolveDateRange(args.DateFrom, args.DateTo, tz);
                query = query.Where(f => f.ScheduledAt >= from && f.ScheduledAt <= to);
            }

            if (!string.IsNullOrEmpty(args.Status))
            {
                if (Enum.TryParse<backend.Models.Enums.FollowupStatus>(args.Status, true, out var parsedStatus))
                {
                    query = query.Where(f => f.Status == parsedStatus);
                }
            }

            if (!string.IsNullOrEmpty(args.ContactName))
            {
                var search = args.ContactName.ToLower();
                query = query.Where(f => f.ContactName.ToLower().Contains(search) || (f.InvestorName != null && f.InvestorName.ToLower().Contains(search)));
            }

            var totalCount = await query.CountAsync(ct);
            var results = await query.OrderBy(f => f.ScheduledAt).Take(limit).Select(f => new
            {
                f.Id,
                f.ContactName,
                f.ContactType,
                f.ContactPhone,
                f.ContactEmail,
                f.Priority,
                Status = f.Status.ToString(),
                ScheduledAt = f.ScheduledAt.ToString("yyyy-MM-dd HH:mm"),
                f.Notes,
                f.Agenda,
                f.OutcomeNotes,
                CompletedAt = f.CompletedAt != null ? f.CompletedAt.Value.ToString("yyyy-MM-dd HH:mm") : null,
                RescheduledTo = f.RescheduledTo != null ? f.RescheduledTo.Value.ToString("yyyy-MM-dd HH:mm") : null,
                CreatedAt = f.CreatedAt.ToString("yyyy-MM-dd"),
                AssignedTo = f.AssignedAgent != null ? f.AssignedAgent.Name : null
            }).ToListAsync(ct);

            return JsonSerializer.Serialize(new { totalCount, results });
        }
    }
}
