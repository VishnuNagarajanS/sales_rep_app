using System.Security.Claims;
using System.Text.Json;
using backend.Data;
using backend.DTOs.Chat;
using backend.Extensions;
using backend.Hubs;
using backend.Models.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers.Chat;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ChatController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IHubContext<PlatformHub, IPlatformHubClient> _hubContext;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<ChatController> _logger;

    public ChatController(
        ApplicationDbContext context,
        IHubContext<PlatformHub, IPlatformHubClient> hubContext,
        IWebHostEnvironment env,
        ILogger<ChatController> logger)
    {
        _context = context;
        _hubContext = hubContext;
        _env = env;
        _logger = logger;
    }

    [HttpGet("conversations")]
    public async Task<ActionResult<List<ChatConversationDto>>> GetConversations(CancellationToken ct = default)
    {
        var userId = User.GetUserId();
        var companyId = User.GetCompanyId();

        var convs = await _context.ChatConversations
            .AsNoTracking()
            .Include(c => c.Participants)
                .ThenInclude(p => p.User)
                    .ThenInclude(u => u!.Role)
            .Include(c => c.Messages.OrderByDescending(m => m.CreatedAt).Take(1))
            .Where(c => c.CompanyId == companyId && c.Participants.Any(p => p.UserId == userId))
            .OrderByDescending(c => c.UpdatedAt)
            .ToListAsync(ct);

        var result = new List<ChatConversationDto>();

        foreach (var c in convs)
        {
            var myParticipant = c.Participants.FirstOrDefault(p => p.UserId == userId);
            var lastMsg = c.Messages.FirstOrDefault();

            // Compute unread count
            int unreadCount = 0;
            if (myParticipant != null && !string.IsNullOrEmpty(myParticipant.LastReadMessageId))
            {
                var lastReadMsg = await _context.ChatMessages
                    .AsNoTracking()
                    .Where(m => m.ConversationId == c.Id && m.Id == myParticipant.LastReadMessageId)
                    .Select(m => m.CreatedAt)
                    .FirstOrDefaultAsync(ct);

                unreadCount = await _context.ChatMessages
                    .AsNoTracking()
                    .CountAsync(m => m.ConversationId == c.Id && m.SenderId != userId && m.CreatedAt > lastReadMsg, ct);
            }
            else
            {
                unreadCount = await _context.ChatMessages
                    .AsNoTracking()
                    .CountAsync(m => m.ConversationId == c.Id && m.SenderId != userId, ct);
            }

            var members = c.Participants.Select(p => new ChatMemberDto
            {
                Id = p.UserId.ToString(),
                Name = p.User?.Name ?? "User",
                Email = p.User?.Email,
                RoleCode = p.User?.Role?.Code ?? "sales_executive",
                RoleName = p.User?.Role?.Name ?? "Sales Executive",
                CompanyId = c.CompanyId.ToString(),
                Status = "online"
            }).ToList();

            result.Add(new ChatConversationDto
            {
                Id = c.Id,
                CompanyId = c.CompanyId.ToString(),
                Type = c.Type,
                Name = c.Type == "dm" 
                    ? members.FirstOrDefault(m => m.Id != userId.ToString())?.Name ?? c.Name 
                    : c.Name,
                MemberIds = members.Select(m => m.Id).ToList(),
                Members = members,
                UnreadCount = unreadCount,
                CreatedAt = c.CreatedAt.ToString("o"),
                UpdatedAt = c.UpdatedAt.ToString("o"),
                IsPinned = myParticipant?.IsPinned,
                IsMuted = myParticipant?.IsMuted,
                LastMessage = lastMsg != null ? new LastMessageDto
                {
                    Content = lastMsg.Content,
                    SenderName = lastMsg.SenderName,
                    IsDeleted = lastMsg.IsDeleted,
                } : null
            });
        }

        // Sort pinned conversations to the top
        result = result
            .OrderByDescending(r => r.IsPinned == true)
            .ThenByDescending(r => r.UpdatedAt)
            .ToList();

        return Ok(result);
    }

    [HttpPost("conversations")]
    public async Task<ActionResult<ChatConversationDto>> CreateConversation(
        [FromBody] CreateConversationRequest req,
        CancellationToken ct = default)
    {
        var currentUserId = User.GetUserId();
        var companyId = User.GetCompanyId();
        var currentUserName = User.FindFirstValue(ClaimTypes.Name) ?? "User";

        var allParticipantIds = req.MemberUserIds.Distinct().ToList();
        if (!allParticipantIds.Contains(currentUserId))
        {
            allParticipantIds.Add(currentUserId);
        }

        // Check if DM already exists
        if (req.Type == "dm" && allParticipantIds.Count == 2)
        {
            var otherUserId = allParticipantIds.First(id => id != currentUserId);
            var existingDm = await _context.ChatConversations
                .Include(c => c.Participants)
                    .ThenInclude(p => p.User)
                        .ThenInclude(u => u!.Role)
                .Where(c => c.CompanyId == companyId && c.Type == "dm" &&
                            c.Participants.Any(p => p.UserId == currentUserId) &&
                            c.Participants.Any(p => p.UserId == otherUserId))
                .FirstOrDefaultAsync(ct);

            if (existingDm != null)
            {
                var existingMembers = existingDm.Participants.Select(p => new ChatMemberDto
                {
                    Id = p.UserId.ToString(),
                    Name = p.User?.Name ?? "User",
                    Email = p.User?.Email,
                    RoleCode = p.User?.Role?.Code ?? "sales_executive",
                    RoleName = p.User?.Role?.Name ?? "Sales Executive",
                    CompanyId = companyId.ToString(),
                    Status = "online"
                }).ToList();

                var otherUser = existingMembers.FirstOrDefault(m => m.Id != currentUserId.ToString());

                return Ok(new ChatConversationDto
                {
                    Id = existingDm.Id,
                    CompanyId = existingDm.CompanyId.ToString(),
                    Type = "dm",
                    Name = otherUser?.Name,
                    MemberIds = existingMembers.Select(m => m.Id).ToList(),
                    Members = existingMembers,
                    CreatedAt = existingDm.CreatedAt.ToString("o"),
                    UpdatedAt = existingDm.UpdatedAt.ToString("o"),
                });
            }
        }

        var convId = !string.IsNullOrWhiteSpace(req.Id)
            ? req.Id
            : (req.Type == "dm" && allParticipantIds.Count == 2
                ? $"conv-dm-{companyId}-{allParticipantIds.Min()}-{allParticipantIds.Max()}"
                : $"conv-{(req.Type == "dm" ? "dm" : "group")}-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}-{Guid.NewGuid().ToString("N")[..6]}");

        var conv = new ChatConversation
        {
            Id = convId,
            CompanyId = companyId,
            Type = req.Type ?? "dm",
            Name = req.Name,
            Description = req.Description,
            CreatedByUserId = currentUserId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        foreach (var pId in allParticipantIds)
        {
            conv.Participants.Add(new ChatParticipant
            {
                ConversationId = convId,
                UserId = pId,
                JoinedAt = DateTime.UtcNow,
            });
        }

        _context.ChatConversations.Add(conv);
        await _context.SaveChangesAsync(ct);

        // Fetch users to populate DTO
        var users = await _context.Users
            .Include(u => u.Role)
            .Where(u => allParticipantIds.Contains(u.Id))
            .ToListAsync(ct);

        var memberDtos = users.Select(u => new ChatMemberDto
        {
            Id = u.Id.ToString(),
            Name = u.Name,
            Email = u.Email,
            RoleCode = u.Role?.Code ?? "sales_executive",
            RoleName = u.Role?.Name ?? "Sales Executive",
            CompanyId = companyId.ToString(),
            Status = "online"
        }).ToList();

        var dto = new ChatConversationDto
        {
            Id = conv.Id,
            CompanyId = conv.CompanyId.ToString(),
            Type = conv.Type,
            Name = conv.Type == "dm" 
                ? memberDtos.FirstOrDefault(m => m.Id != currentUserId.ToString())?.Name ?? conv.Name 
                : conv.Name,
            MemberIds = memberDtos.Select(m => m.Id).ToList(),
            Members = memberDtos,
            CreatedAt = conv.CreatedAt.ToString("o"),
            UpdatedAt = conv.UpdatedAt.ToString("o"),
        };

        // Notify participants via SignalR
        foreach (var pId in allParticipantIds)
        {
            await _hubContext.Clients.Group($"user_{pId}").ChatConversationUpdated(convId);
        }

        return Ok(dto);
    }

    [HttpGet("conversations/{id}/messages")]
    public async Task<ActionResult<List<ChatMessageDto>>> GetMessages(
        string id,
        [FromQuery] int limit = 100,
        CancellationToken ct = default)
    {
        var userId = User.GetUserId();

        var isMember = await _context.ChatParticipants
            .AnyAsync(p => p.ConversationId == id && p.UserId == userId, ct);

        if (!isMember)
        {
            return Forbid();
        }

        var messages = await _context.ChatMessages
            .AsNoTracking()
            .Include(m => m.Attachments)
            .Where(m => m.ConversationId == id)
            .OrderByDescending(m => m.CreatedAt)
            .Take(limit)
            .ToListAsync(ct);

        // Reverse to return in chronological order
        messages.Reverse();

        var dtos = messages.Select(m => MapMessageDto(m)).ToList();
        return Ok(dtos);
    }

    [HttpPost("conversations/{id}/messages")]
    public async Task<ActionResult<ChatMessageDto>> SendMessage(
        string id,
        [FromBody] SendMessageRequest req,
        CancellationToken ct = default)
    {
        var currentUserId = User.GetUserId();
        var companyId = User.GetCompanyId();
        var currentUserName = User.FindFirstValue(ClaimTypes.Name) ?? "User";

        var conv = await _context.ChatConversations
            .Include(c => c.Participants)
            .FirstOrDefaultAsync(c => c.Id == id && c.CompanyId == companyId, ct);

        if (conv == null)
        {
            // Auto-heal deterministic or client-created DM: conv-dm-{compId}-{user1}-{user2}
            var parts = id.Split('-');
            if (parts.Length >= 5 && parts[1] == "dm" && int.TryParse(parts[3], out var u1) && int.TryParse(parts[4], out var u2))
            {
                if (u1 == currentUserId || u2 == currentUserId)
                {
                    conv = new ChatConversation
                    {
                        Id = id,
                        CompanyId = companyId,
                        Type = "dm",
                        CreatedByUserId = currentUserId,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow,
                    };
                    _context.ChatConversations.Add(conv);
                    _context.ChatParticipants.Add(new ChatParticipant { ConversationId = id, UserId = u1, JoinedAt = DateTime.UtcNow });
                    _context.ChatParticipants.Add(new ChatParticipant { ConversationId = id, UserId = u2, JoinedAt = DateTime.UtcNow });
                    await _context.SaveChangesAsync(ct);

                    // Re-query with participants loaded
                    conv = await _context.ChatConversations
                        .Include(c => c.Participants)
                        .FirstOrDefaultAsync(c => c.Id == id && c.CompanyId == companyId, ct);
                }
            }
        }

        if (conv == null)
        {
            return NotFound("Conversation not found");
        }

        var isMember = conv.Participants.Any(p => p.UserId == currentUserId);
        if (!isMember)
        {
            return Forbid();
        }

        var msgId = $"msg-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}-{Guid.NewGuid().ToString("N")[..6]}";

        var msg = new ChatMessage
        {
            Id = msgId,
            ConversationId = id,
            SenderId = currentUserId,
            SenderName = currentUserName,
            Content = req.Content ?? string.Empty,
            MessageType = req.MessageType ?? "text",
            ReplyToMessageId = req.ReplyToMessageId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        if (req.Attachments != null && req.Attachments.Any())
        {
            foreach (var att in req.Attachments)
            {
                msg.Attachments.Add(new ChatAttachment
                {
                    MessageId = msgId,
                    FileName = att.Name,
                    FileUrl = att.DataUrl,
                    FileSize = att.Size,
                    MimeType = att.Type,
                    Category = att.Category,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        _context.ChatMessages.Add(msg);
        conv.UpdatedAt = DateTime.UtcNow;

        // Auto mark as read for sender
        var myParticipant = conv.Participants.FirstOrDefault(p => p.UserId == currentUserId);
        if (myParticipant != null)
        {
            myParticipant.LastReadMessageId = msgId;
        }

        await _context.SaveChangesAsync(ct);

        var dto = MapMessageDto(msg);

        // Real-Time SignalR Broadcast to all conversation participants
        foreach (var p in conv.Participants)
        {
            await _hubContext.Clients.Group($"user_{p.UserId}").ReceiveChatMessage(dto);
            await _hubContext.Clients.Group($"user_{p.UserId}").ChatConversationUpdated(id);
        }

        return Ok(dto);
    }

    [HttpPost("conversations/{id}/read")]
    public async Task<IActionResult> MarkAsRead(string id, CancellationToken ct = default)
    {
        var userId = User.GetUserId();

        var participant = await _context.ChatParticipants
            .FirstOrDefaultAsync(p => p.ConversationId == id && p.UserId == userId, ct);

        if (participant == null)
        {
            return NotFound();
        }

        var latestMessageId = await _context.ChatMessages
            .Where(m => m.ConversationId == id)
            .OrderByDescending(m => m.CreatedAt)
            .Select(m => m.Id)
            .FirstOrDefaultAsync(ct);

        if (!string.IsNullOrEmpty(latestMessageId))
        {
            participant.LastReadMessageId = latestMessageId;
            await _context.SaveChangesAsync(ct);

            await _hubContext.Clients.Group($"user_{userId}").ChatMessageRead(id, userId, latestMessageId);
        }

        return Ok();
    }

    [HttpPatch("conversations/{id}")]
    public async Task<IActionResult> UpdateConversation(
        string id,
        [FromBody] UpdateConversationRequest req,
        CancellationToken ct = default)
    {
        var userId = User.GetUserId();
        var companyId = User.GetCompanyId();

        var conv = await _context.ChatConversations
            .Include(c => c.Participants)
            .FirstOrDefaultAsync(c => c.Id == id && c.CompanyId == companyId, ct);

        if (conv == null) return NotFound();

        var participant = conv.Participants.FirstOrDefault(p => p.UserId == userId);
        if (participant == null) return Forbid();

        if (!string.IsNullOrWhiteSpace(req.Name) && conv.Type == "group")
        {
            conv.Name = req.Name.Trim();
            conv.UpdatedAt = DateTime.UtcNow;
        }

        if (req.IsPinned.HasValue)
        {
            participant.IsPinned = req.IsPinned.Value;
        }

        if (req.IsMuted.HasValue)
        {
            participant.IsMuted = req.IsMuted.Value;
        }

        await _context.SaveChangesAsync(ct);

        await _hubContext.Clients.Group($"user_{userId}").ChatConversationUpdated(id);
        return Ok();
    }

    [HttpPost("conversations/{id}/typing")]
    public async Task<IActionResult> SendTypingNotification(
        string id,
        [FromBody] TypingRequest req,
        CancellationToken ct = default)
    {
        var userId = User.GetUserId();
        var userName = User.FindFirstValue(ClaimTypes.Name) ?? "User";

        var participants = await _context.ChatParticipants
            .AsNoTracking()
            .Where(p => p.ConversationId == id && p.UserId != userId)
            .Select(p => p.UserId)
            .ToListAsync(ct);

        foreach (var pId in participants)
        {
            await _hubContext.Clients.Group($"user_{pId}").ChatUserTyping(id, userId, userName, req.IsTyping);
        }

        return Ok();
    }

    [HttpPost("conversations/{id}/reactions/{messageId}")]
    public async Task<ActionResult<ChatMessageDto>> ToggleReaction(
        string id,
        string messageId,
        [FromBody] AddReactionRequest req,
        CancellationToken ct = default)
    {
        var userId = User.GetUserId();
        var userName = User.FindFirstValue(ClaimTypes.Name) ?? "User";

        var msg = await _context.ChatMessages
            .Include(m => m.Attachments)
            .FirstOrDefaultAsync(m => m.ConversationId == id && m.Id == messageId, ct);

        if (msg == null) return NotFound("Message not found");

        var reactions = new List<ChatReactionDto>();
        if (!string.IsNullOrWhiteSpace(msg.ReactionsJson))
        {
            try
            {
                reactions = JsonSerializer.Deserialize<List<ChatReactionDto>>(msg.ReactionsJson) ?? new List<ChatReactionDto>();
            }
            catch { }
        }

        var existingReaction = reactions.FirstOrDefault(r => r.Emoji == req.Emoji);
        if (existingReaction != null)
        {
            if (existingReaction.Users.Contains(userName))
            {
                existingReaction.Users.Remove(userName);
                existingReaction.Count = existingReaction.Users.Count;
                if (existingReaction.Count <= 0)
                {
                    reactions.Remove(existingReaction);
                }
            }
            else
            {
                existingReaction.Users.Add(userName);
                existingReaction.Count = existingReaction.Users.Count;
            }
        }
        else
        {
            reactions.Add(new ChatReactionDto
            {
                Emoji = req.Emoji,
                Count = 1,
                Users = new List<string> { userName }
            });
        }

        msg.ReactionsJson = JsonSerializer.Serialize(reactions);
        msg.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);

        var dto = MapMessageDto(msg);

        // Broadcast reaction to participants
        var participants = await _context.ChatParticipants
            .AsNoTracking()
            .Where(p => p.ConversationId == id)
            .Select(p => p.UserId)
            .ToListAsync(ct);

        foreach (var pId in participants)
        {
            await _hubContext.Clients.Group($"user_{pId}").ReceiveChatMessage(dto);
        }

        return Ok(dto);
    }

    [HttpPost("conversations/{id}/clear")]
    public async Task<IActionResult> ClearHistory(string id, CancellationToken ct = default)
    {
        var userId = User.GetUserId();
        var companyId = User.GetCompanyId();

        var isMember = await _context.ChatParticipants
            .AnyAsync(p => p.ConversationId == id && p.UserId == userId, ct);

        if (!isMember) return Forbid();

        var messages = await _context.ChatMessages
            .Where(m => m.ConversationId == id)
            .ToListAsync(ct);

        _context.ChatMessages.RemoveRange(messages);
        await _context.SaveChangesAsync(ct);

        await _hubContext.Clients.Group($"user_{userId}").ChatConversationUpdated(id);
        return Ok();
    }

    [HttpPost("conversations/{id}/leave")]
    public async Task<IActionResult> LeaveGroup(string id, CancellationToken ct = default)
    {
        var userId = User.GetUserId();

        var participant = await _context.ChatParticipants
            .FirstOrDefaultAsync(p => p.ConversationId == id && p.UserId == userId, ct);

        if (participant == null) return NotFound();

        _context.ChatParticipants.Remove(participant);
        await _context.SaveChangesAsync(ct);

        await _hubContext.Clients.Group($"user_{userId}").ChatConversationUpdated(id);
        return Ok();
    }

    [HttpPost("upload")]
    public async Task<ActionResult<ChatAttachmentDto>> UploadAttachment(
        IFormFile file,
        CancellationToken ct = default)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest("No file uploaded");
        }

        var uploadsFolder = Path.Combine(_env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"), "uploads", "chat");
        if (!Directory.Exists(uploadsFolder))
        {
            Directory.CreateDirectory(uploadsFolder);
        }

        var ext = Path.GetExtension(file.FileName);
        var uniqueFileName = $"chat_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}_{Guid.NewGuid().ToString("N")[..6]}{ext}";
        var filePath = Path.Combine(uploadsFolder, uniqueFileName);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream, ct);
        }

        var fileUrl = $"/uploads/chat/{uniqueFileName}";
        var category = DetermineCategory(file.ContentType, ext);

        return Ok(new ChatAttachmentDto
        {
            Id = Guid.NewGuid().ToString("N"),
            Name = file.FileName,
            Size = file.Length,
            Type = file.ContentType,
            Category = category,
            DataUrl = fileUrl,
            Permission = "view_download"
        });
    }

    private static string DetermineCategory(string mimeType, string ext)
    {
        var e = ext.ToLowerInvariant();
        if (e == ".pdf") return "PDF";
        if (e == ".png" || e == ".jpg" || e == ".jpeg" || e == ".webp" || e == ".gif") return "Image";
        if (e == ".xlsx" || e == ".xls" || e == ".csv") return "Spreadsheet";
        if (e == ".doc" || e == ".docx" || e == ".txt") return "Document";
        return "Other";
    }

    private static ChatMessageDto MapMessageDto(ChatMessage m)
    {
        var reactions = new List<ChatReactionDto>();
        if (!string.IsNullOrWhiteSpace(m.ReactionsJson))
        {
            try
            {
                reactions = JsonSerializer.Deserialize<List<ChatReactionDto>>(m.ReactionsJson) ?? new List<ChatReactionDto>();
            }
            catch { }
        }

        return new ChatMessageDto
        {
            Id = m.Id,
            ConversationId = m.ConversationId,
            SenderId = m.SenderId.ToString(),
            SenderName = m.SenderName,
            Content = m.Content,
            IsDeleted = m.IsDeleted,
            IsEdited = m.IsEdited,
            CreatedAt = m.CreatedAt.ToString("o"),
            UpdatedAt = m.UpdatedAt.ToString("o"),
            Reactions = reactions,
            Attachments = m.Attachments.Select(a => new ChatAttachmentDto
            {
                Id = a.Id.ToString(),
                Name = a.FileName,
                Size = a.FileSize,
                Type = a.MimeType,
                Category = a.Category,
                DataUrl = a.FileUrl,
                Permission = "view_download"
            }).ToList()
        };
    }
}
