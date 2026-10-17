namespace backend.DTOs.Chat;

public class ChatAttachmentDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public long Size { get; set; }
    public string Type { get; set; } = string.Empty;
    public string? Category { get; set; }
    public string? Permission { get; set; } = "view_download";
    public string DataUrl { get; set; } = string.Empty;
}

public class ChatReactionDto
{
    public string Emoji { get; set; } = string.Empty;
    public int Count { get; set; }
    public List<string> Users { get; set; } = new();
}

public class ChatMessageDto
{
    public string Id { get; set; } = string.Empty;
    public string ConversationId { get; set; } = string.Empty;
    public string SenderId { get; set; } = string.Empty;
    public string SenderName { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public bool IsDeleted { get; set; }
    public bool IsEdited { get; set; }
    public string CreatedAt { get; set; } = string.Empty;
    public string UpdatedAt { get; set; } = string.Empty;
    public List<ChatReactionDto> Reactions { get; set; } = new();
    public List<ChatAttachmentDto>? Attachments { get; set; }
}

public class ChatMemberDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string RoleCode { get; set; } = string.Empty;
    public string RoleName { get; set; } = string.Empty;
    public string CompanyId { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public string Status { get; set; } = "offline";
}

public class LastMessageDto
{
    public string Content { get; set; } = string.Empty;
    public string SenderName { get; set; } = string.Empty;
    public bool IsDeleted { get; set; }
}

public class ChatConversationDto
{
    public string Id { get; set; } = string.Empty;
    public string CompanyId { get; set; } = string.Empty;
    public string Type { get; set; } = "dm"; // "dm" or "group"
    public string? Name { get; set; }
    public List<string> MemberIds { get; set; } = new();
    public List<ChatMemberDto> Members { get; set; } = new();
    public LastMessageDto? LastMessage { get; set; }
    public int UnreadCount { get; set; }
    public string CreatedAt { get; set; } = string.Empty;
    public string UpdatedAt { get; set; } = string.Empty;
    public bool? IsPinned { get; set; }
    public bool? IsMuted { get; set; }
}

public class CreateConversationRequest
{
    public string? Id { get; set; }
    public string Type { get; set; } = "dm"; // "dm" | "group"
    public string? Name { get; set; }
    public string? Description { get; set; }
    public List<int> MemberUserIds { get; set; } = new();
}

public class SendMessageRequest
{
    public string Content { get; set; } = string.Empty;
    public string? MessageType { get; set; } = "text";
    public string? ReplyToMessageId { get; set; }
    public List<ChatAttachmentDto>? Attachments { get; set; }
}

public class TypingRequest
{
    public bool IsTyping { get; set; }
}

public class AddReactionRequest
{
    public string Emoji { get; set; } = string.Empty;
}

public class UpdateConversationRequest
{
    public string? Name { get; set; }
    public bool? IsPinned { get; set; }
    public bool? IsMuted { get; set; }
}
