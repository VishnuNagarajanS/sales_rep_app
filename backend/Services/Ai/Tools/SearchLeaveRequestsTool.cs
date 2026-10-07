using System.Text.Json;
using System.Text.Json.Nodes;
using backend.Data;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Ai.Tools
{
    public class SearchLeaveRequestsTool : AiTool
    {
        public override string Name => "search_leave_requests";
        public override string Description => "Search leave requests submitted by the team.";
        
        public override JsonObject Parameters => JsonNode.Parse(@"
        {
            ""type"": ""object"",
            ""properties"": {
                ""status"": { ""type"": ""string"", ""description"": ""Status (e.g., Pending, Approved, Rejected)"" }
            }
        }")!.AsObject();

        private class Args
        {
            public string? Status { get; set; }
        }

        public override async Task<string> ExecuteAsync(string arguments, AiDataScope scope, IServiceProvider services, CancellationToken ct)
        {
            var args = ParseArgs<Args>(arguments) ?? new Args();
            var db = services.GetRequiredService<ApplicationDbContext>();

            var query = db.LeaveRequests.AsNoTracking().Where(l => l.CompanyId == scope.CompanyId);

            if (!string.IsNullOrEmpty(args.Status))
            {
                var lowerStatus = args.Status.ToLower();
                query = query.Where(l => l.Status.ToLower() == lowerStatus);
            }

            var totalCount = await query.CountAsync(ct);
            var results = await query.OrderByDescending(l => l.CreatedAt).Take(25).Select(l => new
            {
                l.Id,
                l.LeaveType,
                l.Status,
                StartDate = l.StartDate.ToString("yyyy-MM-dd"),
                EndDate = l.EndDate.ToString("yyyy-MM-dd"),
                l.Days,
                l.Reason,
                UserName = l.User != null ? l.User.Name : null
            }).ToListAsync(ct);

            return JsonSerializer.Serialize(new { totalCount, results });
        }
    }
}
