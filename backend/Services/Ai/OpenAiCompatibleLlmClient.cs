using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace backend.Services.Ai
{
    public class OpenAiCompatibleLlmClient : ILlmClient
    {
        private readonly HttpClient _httpClient;
        
        public OpenAiCompatibleLlmClient(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        public async Task<LlmResponse> SendChatAsync(LlmRequest request, CancellationToken ct = default)
        {
            var payload = new
            {
                model = request.Model,
                messages = request.Messages.Select(m => new
                {
                    role = m.Role,
                    content = m.Content,
                    name = m.Name,
                    tool_call_id = m.ToolCallId,
                    tool_calls = m.ToolCalls?.Select(tc => new
                    {
                        id = tc.Id,
                        type = tc.Type,
                        function = new
                        {
                            name = tc.Function.Name,
                            arguments = tc.Function.Arguments
                        }
                    }).ToList()
                }).ToList(),
                tools = request.Tools?.Select(t => new
                {
                    type = t.Type,
                    function = new
                    {
                        name = t.Function.Name,
                        description = t.Function.Description,
                        parameters = t.Function.Parameters
                    }
                }).ToList(),
                temperature = request.Temperature,
                max_tokens = request.MaxTokens
            };

            var jsonOptions = new JsonSerializerOptions { DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull };
            var response = await _httpClient.PostAsJsonAsync("chat/completions", payload, jsonOptions, ct);
            
            if (!response.IsSuccessStatusCode)
            {
                var errStr = await response.Content.ReadAsStringAsync(ct);
                throw new Exception($"LLM API Error: {response.StatusCode} - {errStr}");
            }
            
            var responseData = await response.Content.ReadFromJsonAsync<OpenAiResponse>(jsonOptions, ct);
            var choice = responseData?.Choices?.FirstOrDefault()?.Message;
            
            return new LlmResponse
            {
                Content = choice?.Content,
                ToolCalls = choice?.ToolCalls?.Select(tc => new LlmToolCall
                {
                    Id = tc.Id,
                    Type = tc.Type,
                    Function = new LlmFunctionCall
                    {
                        Name = tc.Function.Name,
                        Arguments = tc.Function.Arguments
                    }
                }).ToList(),
                PromptTokens = responseData?.Usage?.PromptTokens ?? 0,
                CompletionTokens = responseData?.Usage?.CompletionTokens ?? 0
            };
        }

        private class OpenAiResponse
        {
            [JsonPropertyName("choices")]
            public List<OpenAiChoice>? Choices { get; set; }
            [JsonPropertyName("usage")]
            public OpenAiUsage? Usage { get; set; }
        }

        private class OpenAiChoice
        {
            [JsonPropertyName("message")]
            public OpenAiMessage? Message { get; set; }
        }

        private class OpenAiMessage
        {
            [JsonPropertyName("content")]
            public string? Content { get; set; }
            [JsonPropertyName("tool_calls")]
            public List<OpenAiToolCall>? ToolCalls { get; set; }
        }

        private class OpenAiToolCall
        {
            [JsonPropertyName("id")]
            public string Id { get; set; } = string.Empty;
            [JsonPropertyName("type")]
            public string Type { get; set; } = string.Empty;
            [JsonPropertyName("function")]
            public OpenAiFunctionCall Function { get; set; } = new();
        }

        private class OpenAiFunctionCall
        {
            [JsonPropertyName("name")]
            public string Name { get; set; } = string.Empty;
            [JsonPropertyName("arguments")]
            public string Arguments { get; set; } = string.Empty;
        }

        private class OpenAiUsage
        {
            [JsonPropertyName("prompt_tokens")]
            public int PromptTokens { get; set; }
            [JsonPropertyName("completion_tokens")]
            public int CompletionTokens { get; set; }
        }
    }
}
