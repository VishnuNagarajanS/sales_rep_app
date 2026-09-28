namespace backend.Models.Entities;

public class CustomerKyc
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public int CustomerId { get; set; }
    public Customer? Customer { get; set; }

    // Identification details
    public string DocumentType { get; set; } = "PAN"; // Aadhaar, PAN, Passport, VoterId, DrivingLicense, NationalId
    public string DocumentNumber { get; set; } = string.Empty; // e.g. ABCDE1234F
    public string? FullNameAsPerDocument { get; set; }
    public DateTime? DateOfBirth { get; set; }
    public string? Gender { get; set; }
    public string? Nationality { get; set; } = "Indian";

    // Address verification details
    public string? AddressLine1 { get; set; }
    public string? AddressLine2 { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? PostalCode { get; set; }
    public string? Country { get; set; } = "India";

    // Verification Workflow
    public string Status { get; set; } = "Pending"; // Pending, Submitted, UnderReview, Verified, Rejected
    public DateTime? SubmittedAt { get; set; }
    public DateTime? VerifiedAt { get; set; }
    public int? VerifiedByUserId { get; set; }
    public User? VerifiedByUser { get; set; }
    public string? RejectionReason { get; set; }
    public string? VerificationRemarks { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public ICollection<KycDocument> Documents { get; set; } = new List<KycDocument>();
}
