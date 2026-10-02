namespace backend.Models.Entities;

public class KycOtpVerification
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public int? InvestorKycId { get; set; }
    public InvestorKyc? InvestorKyc { get; set; }
    public string Token { get; set; } = string.Empty;
    public string TokenHash { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string OtpHash { get; set; } = string.Empty;
    public int FailedAttempts { get; set; } = 0;
    public int ResendCount { get; set; } = 0;
    public DateTime ExpiresAt { get; set; }
    public bool IsVerified { get; set; } = false;
    public DateTime? VerifiedAt { get; set; }
    public bool IsInvalidated { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
