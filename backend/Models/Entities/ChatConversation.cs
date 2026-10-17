namespace backend.Models.Entities;

public class ChatConversation
{
    public string Id { get; set; } = string.Empty;
    public int CompanyId { get; set; }
    public string Type { get; set; } = "dm"; // "dm" or "group"
    public string? Name { get; set; }
    public string? Description { get; set; }
    public int CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<ChatParticipant> Participants { get; set; } = new List<ChatParticipant>();
    public ICollection<ChatMessage> Messages { get; set; } = new List<ChatMessage>();
}
