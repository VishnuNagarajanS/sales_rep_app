using System.Text.Json;
using System.Text.Json.Nodes;
using backend.Data;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Ai.Tools
{
    public class SearchNotificationsTool : AiTool
    {
        public override string Name => "search_notifications";
        public override string Description => "Search for notifications and alerts sent to users.";
        
        public override JsonObject Parameters => JsonNode.Parse(@"
        {
            ""type"": ""object"",
            ""properties"": {
                ""isRead"": { ""type"": ""boolean"", ""description"": ""Filter by read or unread status"" },
                ""userName"": { ""type"": ""string"", ""description"": ""Search notifications for a specific user name"" }
            }
        }")!.AsObject();

        private class Args
        {
            public bool? IsRead { get; set; }
            public string? UserName { get; set; }
        }

        public override async Task<string> ExecuteAsync(string arguments, AiDataScope scope, IServiceProvider services, CancellationToken ct)
        {
            var args = ParseArgs<Args>(arguments) ?? new Args();
            var aiSettings = services.GetRequiredService<Microsoft.Extensions.Options.IOptionsSnapshot<AiSettings>>().Value;
            var limit = aiSettings.MaxRowsPerTool > 0 ? aiSettings.MaxRowsPerTool : 25;
            var includeContact = aiSettings.IncludeContactDetails;
            
            var db = services.GetRequiredService<ApplicationDbContext>();

            var query = db.Notifications.AsNoTracking().Where(n => n.CompanyId == scope.CompanyId);

            if (args.IsRead.HasValue)
            {
                query = query.Where(n => n.IsRead == args.IsRead.Value);
            }

            var totalCount = await query.CountAsync(ct);
            var results = await query.OrderByDescending(n => n.CreatedAt).Take(limit).Select(n => new
            {
                n.Id,
                n.Title,
                n.Message,
                n.Type,
                n.IsRead,
                CreatedAt = n.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss"),
                n.UserId
            }).ToListAsync(ct);

            return JsonSerializer.Serialize(new { totalCount, results });
        }
    }
}
