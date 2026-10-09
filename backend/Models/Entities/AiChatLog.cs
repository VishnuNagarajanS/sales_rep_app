namespace backend.Models.Entities
{
    public class AiChatLog
    {
        public int Id { get; set; }
        public int CompanyId { get; set; }
        public int UserId { get; set; }
        public DateTime AskedAt { get; set; }
        public string Question { get; set; } = string.Empty;
        public string? ToolsCalled { get; set; }
        public bool Declined { get; set; }
        public string? Provider { get; set; }
        public string? Model { get; set; }
        public int PromptTokens { get; set; }
        public int CompletionTokens { get; set; }
        public long LatencyMs { get; set; }
        public string? Error { get; set; }

        public Tenant? Company { get; set; }
        public User? User { get; set; }
    }
}
