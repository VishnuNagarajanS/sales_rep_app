namespace backend.Models.Entities;

public class ChatAttachment
{
    public int Id { get; set; }
    public string MessageId { get; set; } = string.Empty;
    public ChatMessage? Message { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string FileUrl { get; set; } = string.Empty;
    public long FileSize { get; set; }
    public string MimeType { get; set; } = "application/octet-stream";
    public string? Category { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
