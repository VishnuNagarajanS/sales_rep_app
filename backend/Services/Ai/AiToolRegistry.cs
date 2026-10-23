using System.Text.Json;
using System.Text.Json.Nodes;

namespace backend.Services.Ai
{
    public abstract class AiTool
    {
        public abstract string Name { get; }
        public abstract string Description { get; }
        public abstract JsonObject Parameters { get; }
        
        public abstract Task<string> ExecuteAsync(string arguments, AiDataScope scope, IServiceProvider services, CancellationToken ct);

        protected T? ParseArgs<T>(string arguments)
        {
            if (string.IsNullOrWhiteSpace(arguments)) return default;
            try
            {
                return JsonSerializer.Deserialize<T>(arguments, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            }
            catch
            {
                return default;
            }
        }
    }

    public class AiToolRegistry
    {
        private readonly Dictionary<string, AiTool> _tools = new();

        public void Register(AiTool tool)
        {
            _tools[tool.Name] = tool;
        }

        private static bool IsToolAllowedForRole(string toolName, string roleCode)
        {
            var role = (roleCode ?? "").ToLowerInvariant();
            bool isAdmin = role == "company_admin" || role == "super_admin" || role == "admin" || role == "ghl_admin";
            if (isAdmin) return true;

            if (role == "sales_executive")
            {
                return toolName switch
                {
                    "search_leads" => true,
                    "search_followups" => true,
                    "search_calls" => true,
                    "search_customers" => true,
                    "search_company_knowledge" => true,
                    "search_leave_requests" => true,
                    "search_work_handovers" => true,
                    "search_notifications" => true,
                    "decline_out_of_scope" => true,
                    _ => false
                };
            }

            if (role == "irm")
            {
                return toolName switch
                {
                    "search_investors" => true,
                    "search_deals" => true,
                    "search_consultations" => true,
                    "search_followups" => true,
                    "search_calls" => true,
                    "search_company_knowledge" => true,
                    "search_leave_requests" => true,
                    "search_work_handovers" => true,
                    "search_notifications" => true,
                    "decline_out_of_scope" => true,
                    _ => false
                };
            }

            return false;
        }

        public List<LlmTool> GetToolsForRole(string roleCode)
        {
            return _tools.Values
                .Where(t => IsToolAllowedForRole(t.Name, roleCode))
                .Select(t => new LlmTool
                {
                    Type = "function",
                    Function = new LlmFunction
                    {
                        Name = t.Name,
                        Description = t.Description,
                        Parameters = t.Parameters
                    }
                }).ToList();
        }

        public async Task<string> ExecuteToolAsync(string name, string arguments, AiDataScope scope, IServiceProvider services, CancellationToken ct)
        {
            if (!_tools.TryGetValue(name, out var tool) || !IsToolAllowedForRole(name, scope.RoleCode))
            {
                return "{\"error\":\"Tool not found or forbidden for your role\"}";
            }

            try
            {
                var result = await tool.ExecuteAsync(arguments, scope, services, ct);
                return $"<data tool=\"{name}\">{result}</data>";
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[AiToolRegistry] Error executing tool {name}: {ex.Message}");
                return System.Text.Json.JsonSerializer.Serialize(new { error = "Tool failed" });
            }
        }
    }
}
