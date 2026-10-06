namespace backend.Services.Ai
{
    public class AiSettings
    {
        public bool Enabled { get; set; } = true;
        public LlmProviderSettings Primary { get; set; } = new();
        public LlmProviderSettings Fallback { get; set; } = new();
        public int TimeoutSeconds { get; set; } = 20;
        public int MaxToolRounds { get; set; } = 3;
        public int MaxRowsPerTool { get; set; } = 25;
        public bool IncludeContactDetails { get; set; } = false;
        public string TimeZone { get; set; } = "Asia/Kolkata";
        public string OutOfScopeMessage { get; set; } = "I can only help with your NexusSales data and how to use this app, like leads, follow-ups, customers, deals, calls, leave and reports. Try asking: \"Which leads came in yesterday?\"";
    }

    public class LlmProviderSettings
    {
        public bool Enabled { get; set; } = true;
        public string BaseUrl { get; set; } = string.Empty;
        public string Model { get; set; } = string.Empty;
        public string ApiKey { get; set; } = string.Empty;
    }
}
