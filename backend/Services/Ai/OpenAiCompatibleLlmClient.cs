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
            
            HttpResponseMessage? response = null;
            for (int i = 0; i < 3; i++)
            {
                response = await _httpClient.PostAsJsonAsync("chat/completions", payload, jsonOptions, ct);
                if (response.IsSuccessStatusCode) break;
                
                var errStr = await response.Content.ReadAsStringAsync(ct);
                if (response.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
                {
                    double waitSeconds = 4.0;
                    // Try to match seconds (e.g. 15.536s) or minutes and seconds (e.g. 15m49.536s)
                    var matchSec = System.Text.RegularExpressions.Regex.Match(errStr, @"try again in ([0-9.]+)s");
                    var matchMin = System.Text.RegularExpressions.Regex.Match(errStr, @"try again in ([0-9]+)m([0-9.]+)s");
                    
                    if (matchMin.Success && double.TryParse(matchMin.Groups[1].Value, out double m) && double.TryParse(matchMin.Groups[2].Value, out double s))
                    {
                        waitSeconds = (m * 60) + s + 0.5;
                    }
                    else if (matchSec.Success && double.TryParse(matchSec.Groups[1].Value, out double parsedSec))
                    {
                        waitSeconds = parsedSec + 0.5;
                    }

                    // If wait time is reasonable (e.g. < 20s) and we have retries left, wait and retry.
                    if (waitSeconds < 20.0 && i < 2)
                    {
                        await Task.Delay(TimeSpan.FromSeconds(waitSeconds), ct);
                        continue;
                    }
                    
                    // Otherwise, gracefully return a friendly error message as the AI's response
                    return new LlmResponse
                    {
                        Content = "I apologize, but I am currently receiving too many requests and have temporarily reached my data processing limit. Please try again in a little while.",
                        PromptTokens = 0,
                        CompletionTokens = 0
                    };
                }
                
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
