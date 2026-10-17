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

        public List<LlmTool> GetToolsForRole(string roleCode)
        {
            // For now, only admin tools
            return _tools.Values.Select(t => new LlmTool
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
            if (!_tools.TryGetValue(name, out var tool))
            {
                return "{\"error\":\"Tool not found or forbidden\"}";
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
