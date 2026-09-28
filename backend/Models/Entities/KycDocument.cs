namespace backend.Models.Entities;

public class KycDocument
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public int? CustomerId { get; set; }
    public Customer? Customer { get; set; }
    public int? CustomerKycId { get; set; }
    public CustomerKyc? CustomerKyc { get; set; }

    public string EntityType { get; set; } = "customer"; // customer, lead, investor
    public int EntityId { get; set; }

    public string Category { get; set; } = "KYC"; // KYC, Identity Proof, Agreement, Payment Receipt, Other
    public string DocumentName { get; set; } = string.Empty;
    public string OriginalFileName { get; set; } = string.Empty;
    public string StoredFileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long FileSizeBytes { get; set; }
    public string StoragePath { get; set; } = string.Empty;

    public string Status { get; set; } = "Pending"; // Pending, Verified, Rejected
    public int UploadedByUserId { get; set; }
    public User? UploadedByUser { get; set; }
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

    public int? VerifiedByUserId { get; set; }
    public User? VerifiedByUser { get; set; }
    public DateTime? VerifiedAt { get; set; }
    public string? RejectionReason { get; set; }
}
