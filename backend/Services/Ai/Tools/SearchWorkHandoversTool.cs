using System.Text.Json;
using System.Text.Json.Nodes;
using backend.Data;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Ai.Tools
{
    public class SearchWorkHandoversTool : AiTool
    {
        public override string Name => "search_work_handovers";
        public override string Description => "Search for work handovers and reassigned duties between team members.";
        
        public override JsonObject Parameters => JsonNode.Parse(@"
        {
            ""type"": ""object"",
            ""properties"": {
                ""status"": { ""type"": ""string"", ""description"": ""Status (e.g., Pending, Active, Completed, Cancelled)"" },
                ""userName"": { ""type"": ""string"", ""description"": ""Search by the user who handed over work or received work"" }
            }
        }")!.AsObject();

        private class Args
        {
            public string? Status { get; set; }
            public string? UserName { get; set; }
        }

        public override async Task<string> ExecuteAsync(string arguments, AiDataScope scope, IServiceProvider services, CancellationToken ct)
        {
            var args = ParseArgs<Args>(arguments) ?? new Args();
            var aiSettings = services.GetRequiredService<Microsoft.Extensions.Options.IOptionsSnapshot<AiSettings>>().Value;
            var limit = aiSettings.MaxRowsPerTool > 0 ? aiSettings.MaxRowsPerTool : 25;
            var includeContact = aiSettings.IncludeContactDetails;
            
            var db = services.GetRequiredService<ApplicationDbContext>();

            var query = db.WorkHandovers.AsNoTracking().Where(w => w.CompanyId == scope.CompanyId);

            if (!string.IsNullOrEmpty(args.Status))
            {
                var lowerStatus = args.Status.ToLower();
                query = query.Where(w => w.Status == lowerStatus);
            }

            if (!string.IsNullOrEmpty(args.UserName))
            {
                var search = args.UserName.ToLower();
                query = query.Where(w => 
                    (w.OriginalUser != null && w.OriginalUser.Name.ToLower().Contains(search)) || 
                    (w.CoveringUser != null && w.CoveringUser.Name.ToLower().Contains(search)));
            }

            var totalCount = await query.CountAsync(ct);
            var results = await query.OrderByDescending(w => w.StartedAt).Take(limit).Select(w => new
            {
                w.Id,
                OriginalOwner = w.OriginalUser != null ? w.OriginalUser.Name : null,
                CoveringUser = w.CoveringUser != null ? w.CoveringUser.Name : null,
                w.RoleCode,
                w.Status,
                w.Reason,
                StartedAt = w.StartedAt.ToString("yyyy-MM-dd"),
                PlannedEndAt = w.PlannedEndAt.HasValue ? w.PlannedEndAt.Value.ToString("yyyy-MM-dd") : null,
                EndedAt = w.EndedAt.HasValue ? w.EndedAt.Value.ToString("yyyy-MM-dd") : null,
                w.LeaveRequestId
            }).ToListAsync(ct);

            return JsonSerializer.Serialize(new { totalCount, results });
        }
    }
}
