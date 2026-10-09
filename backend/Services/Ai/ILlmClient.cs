using System.Text.Json.Nodes;

namespace backend.Services.Ai
{
    public interface ILlmClient
    {
        Task<LlmResponse> SendChatAsync(LlmRequest request, CancellationToken ct = default);
    }

    public class LlmRequest
    {
        public string Model { get; set; } = string.Empty;
        public List<LlmMessage> Messages { get; set; } = new();
        public List<LlmTool>? Tools { get; set; }
        public float Temperature { get; set; } = 0.2f;
        public int MaxTokens { get; set; } = 600;
    }

    public class LlmMessage
    {
        public string Role { get; set; } = string.Empty;
        public string? Content { get; set; }
        public string? Name { get; set; }
        public string? ToolCallId { get; set; }
        public List<LlmToolCall>? ToolCalls { get; set; }
    }

    public class LlmTool
    {
        public string Type { get; set; } = "function";
        public LlmFunction Function { get; set; } = new();
    }

    public class LlmFunction
    {
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public JsonObject Parameters { get; set; } = new();
    }

    public class LlmToolCall
    {
        public string Id { get; set; } = string.Empty;
        public string Type { get; set; } = "function";
        public LlmFunctionCall Function { get; set; } = new();
    }

    public class LlmFunctionCall
    {
        public string Name { get; set; } = string.Empty;
        public string Arguments { get; set; } = string.Empty;
    }

    public class LlmResponse
    {
        public string? Content { get; set; }
        public List<LlmToolCall>? ToolCalls { get; set; }
        public int PromptTokens { get; set; }
        public int CompletionTokens { get; set; }
    }
}
