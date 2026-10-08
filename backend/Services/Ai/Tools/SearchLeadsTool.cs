using backend.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace backend.Services.Ai.Tools
{
    public class SearchLeadsTool : AiTool
    {
        public override string Name => "search_leads";
        public override string Description => "Search leads by date range, status, or text. The returned results include the lead's AssignedTo agent name, status, priority, and notes.";
        
        public override JsonObject Parameters => new JsonObject
        {
            ["type"] = "object",
            ["properties"] = new JsonObject
            {
                ["dateFrom"] = new JsonObject { ["type"] = "string", ["description"] = "YYYY-MM-DD" },
                ["dateTo"] = new JsonObject { ["type"] = "string", ["description"] = "YYYY-MM-DD" },
                ["status"] = new JsonObject { ["type"] = "string" },
                ["text"] = new JsonObject { ["type"] = "string" }
            }
        };

        public override async Task<string> ExecuteAsync(string arguments, AiDataScope scope, IServiceProvider services, CancellationToken ct)
        {
            var args = ParseArgs<Args>(arguments) ?? new Args();
            var aiSettings = services.GetRequiredService<Microsoft.Extensions.Options.IOptionsSnapshot<AiSettings>>().Value;
            var limit = aiSettings.MaxRowsPerTool > 0 ? aiSettings.MaxRowsPerTool : 25;
            var includeContact = aiSettings.IncludeContactDetails;
            
            var db = services.GetRequiredService<ApplicationDbContext>();

            var query = db.Leads.AsNoTracking().Where(l => l.CompanyId == scope.CompanyId);

            if (!string.IsNullOrEmpty(args.DateFrom) || !string.IsNullOrEmpty(args.DateTo))
            {
                var clock = services.GetRequiredService<backend.Services.Interfaces.ICompanyClock>();
                var tz = await clock.GetTimeZoneAsync(scope.CompanyId, ct);
                var (from, to) = AiDateResolver.ResolveDateRange(args.DateFrom, args.DateTo, tz);
                query = query.Where(l => l.CreatedAt >= from && l.CreatedAt <= to);
            }

            if (!string.IsNullOrEmpty(args.Status))
            {
                query = query.Where(l => l.Status == args.Status);
            }

            if (!string.IsNullOrEmpty(args.Text))
            {
                var search = args.Text.ToLower();
                query = query.Where(l => l.Name.ToLower().Contains(search) || (l.Notes != null && l.Notes.ToLower().Contains(search)));
            }

            var totalCount = await query.CountAsync(ct);
            var results = await query.OrderByDescending(l => l.CreatedAt).Take(limit).Select(l => new
            {
                l.Id,
                l.Name,
                Email = includeContact ? l.Email : "[REDACTED]",
                Phone = includeContact ? l.Phone : "[REDACTED]",
                l.Location,
                l.Source,
                l.Status,
                l.Priority,
                NextFollowup = l.NextFollowupDate != null ? l.NextFollowupDate.Value.ToString("yyyy-MM-dd") : null,
                CreatedAt = l.CreatedAt.ToString("yyyy-MM-dd"),
                AssignedTo = l.AssignedAgent != null ? l.AssignedAgent.Name : null
            }).ToListAsync(ct);

            return JsonSerializer.Serialize(new { totalCount, results });
        }

        private class Args
        {
            public string? DateFrom { get; set; }
            public string? DateTo { get; set; }
            public string? Status { get; set; }
            public string? Text { get; set; }
        }
    }
}
