namespace backend.DTOs.Calls;

public class SendCustomerMessageRequestDto
{
    public string Channel { get; set; } = "email";
    public string? RecipientEmail { get; set; }
    public string? RecipientPhone { get; set; }
    public string RecipientName { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public int? LeadId { get; set; }
    public int? CustomerId { get; set; }
    public int? DealId { get; set; }
}

public class SendCustomerMessageResponseDto
{
    public bool Success { get; set; }
    public bool Delivered { get; set; }
    public string Channel { get; set; } = "email";
    public string? Recipient { get; set; }
    public string Message { get; set; } = string.Empty;
    public string DeliveryResult { get; set; } = string.Empty;
    public DateTime SentAt { get; set; } = DateTime.UtcNow;
    public string SentByName { get; set; } = string.Empty;
    public string SentByRole { get; set; } = string.Empty;
}

public class MessagingChannelStatusDto
{
    public string Channel { get; set; } = string.Empty; // "email" | "sms" | "whatsapp"
    public string Name { get; set; } = string.Empty;
    public bool Configured { get; set; }
    public string Provider { get; set; } = string.Empty;
    public string StatusMessage { get; set; } = string.Empty;
}
