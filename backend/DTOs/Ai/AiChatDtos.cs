namespace backend.DTOs.Ai
{
    public class AiChatRequestDto
    {
        public string Message { get; set; } = string.Empty;
        public List<AiChatMessageDto> History { get; set; } = new();
    }

    public class AiChatMessageDto
    {
        public string Role { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
    }

    public class AiChatResponseDto
    {
        public string Answer { get; set; } = string.Empty;
        public List<AiReferenceDto> References { get; set; } = new();
        public List<string> Suggestions { get; set; } = new();
        public bool Declined { get; set; }
    }

    public class AiReferenceDto
    {
        public string Type { get; set; } = string.Empty;
        public string Id { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
        public string Route { get; set; } = string.Empty;
    }
}
