using System.Text.Json.Nodes;

namespace backend.Services.Ai.Tools
{
    public class DeclineOutOfScopeTool : AiTool
    {
        public override string Name => "decline_out_of_scope";
        public override string Description => "Call this immediately if the user asks anything unrelated to their NexusSales data or how to use this CRM app.";
        
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
