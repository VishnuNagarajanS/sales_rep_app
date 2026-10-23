namespace backend.DTOs.Jamin;

public class WebsiteMessageInquiryDto
{
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? TargetDevelopment { get; set; }
    public string Message { get; set; } = string.Empty;
}
