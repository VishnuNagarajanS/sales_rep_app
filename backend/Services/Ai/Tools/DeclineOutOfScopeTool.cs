using System.Text.Json.Nodes;

namespace backend.Services.Ai.Tools
{
    public class DeclineOutOfScopeTool : AiTool
    {
        public const string ToolName = "decline_out_of_scope";
        public override string Name => ToolName;
        public override string Description => "Call this ONLY if the user asks something completely unrelated to NexusSales, CRM, or the company GHL India Ventures (GHL). Questions about GHL are IN-SCOPE.";
        
        public override JsonObject Parameters => new JsonObject
        {
            ["type"] = "object",
            ["properties"] = new JsonObject()
        };

        public override Task<string> ExecuteAsync(string arguments, AiDataScope scope, IServiceProvider services, CancellationToken ct)
        {
            return Task.FromResult("");
        }
    }
}
