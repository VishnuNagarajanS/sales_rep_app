namespace backend.Models.Entities;

public class ChatParticipant
{
    public int Id { get; set; }
    public string ConversationId { get; set; } = string.Empty;
    public ChatConversation? Conversation { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
    public string? LastReadMessageId { get; set; }
    public bool IsPinned { get; set; }
    public bool IsMuted { get; set; }
}
