using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using backend.Data;
using Microsoft.Extensions.Hosting;

namespace backend.Services.Ai.Tools
{
    public class SearchCompanyKnowledgeTool : AiTool
    {
        private static List<string>? _paragraphs;
        private static readonly object _lock = new object();

        public override string Name => "search_company_knowledge";
        public override string Description => "Search the company knowledge base (Website, PPM, Agreements, Policies) for information about GHL India Ventures, its products, policies, or general company details.";
        
        public override JsonObject Parameters => JsonNode.Parse(@"
        {
            ""type"": ""object"",
            ""properties"": {
                ""query"": { ""type"": ""string"", ""description"": ""The question or keywords to search for in the company knowledge base (e.g., 'minimum investment', 'SEBI registration', 'AIF category')"" }
            },
            ""required"": [""query""]
        }")!.AsObject();

        private class Args
        {
            public string? Query { get; set; }
        }

        public override async Task<string> ExecuteAsync(string arguments, AiDataScope scope, IServiceProvider services, CancellationToken ct)
        {
            var args = ParseArgs<Args>(arguments);
            if (args == null || string.IsNullOrWhiteSpace(args.Query))
            {
                return JsonSerializer.Serialize(new { error = "Query is required." });
            }

            var env = services.GetRequiredService<IWebHostEnvironment>();
            var knowledgePath = Path.Combine(env.ContentRootPath, "Data", "CompanyKnowledge.txt");

            if (!File.Exists(knowledgePath))
            {
                return JsonSerializer.Serialize(new { error = "Knowledge base file not found." });
            }

            // Lazy load paragraphs
            if (_paragraphs == null)
            {
                lock (_lock)
                {
                    if (_paragraphs == null)
                    {
                        var text = File.ReadAllText(knowledgePath);
                        // Split by double newlines or similar block separators
                        _paragraphs = Regex.Split(text, @"\n\s*\n")
                                           .Where(p => !string.IsNullOrWhiteSpace(p))
                                           .Select(p => p.Trim())
                                           .ToList();
                    }
                }
            }

            // Simple Keyword Search (Scoring based on word overlap)
            var queryWords = args.Query.ToLower().Split(new[] { ' ', '\t', '\n', '\r', ',', '.', '?', '!' }, StringSplitOptions.RemoveEmptyEntries)
                                       .Where(w => w.Length > 2) // Ignore very short words like 'is', 'a', 'to'
                                       .ToHashSet();

            if (!queryWords.Any())
            {
                queryWords = new HashSet<string> { args.Query.ToLower() };
            }

            var scoredParagraphs = _paragraphs.Select(p =>
            {
                var pLower = p.ToLower();
                int score = queryWords.Count(w => pLower.Contains(w));
                return new { Paragraph = p, Score = score };
            })
            .Where(x => x.Score > 0)
            .OrderByDescending(x => x.Score)
            .Take(3) // Reduced from 15 to 3 to prevent LLM token limits (Groq 7000 ITPM limit)
            .Select(x => x.Paragraph.Length > 600 ? x.Paragraph.Substring(0, 600) + "..." : x.Paragraph)
            .ToList();

            if (!scoredParagraphs.Any())
            {
                return JsonSerializer.Serialize(new { message = "No relevant information found in the knowledge base for that query. Suggest trying different keywords." });
            }

            return JsonSerializer.Serialize(new { 
                results = scoredParagraphs,
                note = "Use the information above to answer the user's question accurately. Do NOT hallucinate information not found here." 
            });
        }
    }
}
