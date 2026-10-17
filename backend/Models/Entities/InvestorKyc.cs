using backend.Models.Enums;

namespace backend.Models.Entities;

public class InvestorKyc
{
    public int Id { get; set; }

    public int InvestorId { get; set; }
    public Investor Investor { get; set; } = null!;

    public int CompanyId { get; set; }
    public Tenant Company { get; set; } = null!;

    // IRM who submitted/manages this KYC
    public int? IrmId { get; set; }
    public User? Irm { get; set; }

    public int? HandoverId { get; set; }
    public WorkHandover? Handover { get; set; }
    public int? OriginalOwnerId { get; set; }
    public User? OriginalOwner { get; set; }

    public KycStatus Status { get; set; } = KycStatus.Draft;

    // Step 1: Basic Details
    public string InvestorName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? FatherName { get; set; }
    public string? DateOfBirth { get; set; }
    public string? NameAsPerPan { get; set; }
    public string Gender { get; set; } = string.Empty;          // Male | Female | Other
    public string InvestorType { get; set; } = string.Empty;   // Individual | HUF | Corporate | NRI
    public string ResidentType { get; set; } = string.Empty;   // Resident | Non-Resident
    public string? Occupation { get; set; }

    // Step 2: Address & Identification
    public string? PanNumber { get; set; }
    public string? AadhaarNumber { get; set; }
    public string? AddressLine1 { get; set; }
    public string? AddressLine2 { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Pincode { get; set; }
    public string? Country { get; set; } = "India";

    // Step 3: Bank Details
    public string? BankName { get; set; }
    public string? AccountNumber { get; set; }
    public string? IfscCode { get; set; }
    public string? AccountType { get; set; }    // Savings | Current
    public string? DematAccountNumber { get; set; }
    public string? DpId { get; set; }

    // Step 4: Nominee Details (stored as JSON string)
    public string? NomineesJson { get; set; }

    // Step 5: Documents
    public string? PanDocumentUrl { get; set; }
    public string? AadhaarDocumentUrl { get; set; }
    public string? BankChequeUrl { get; set; }
    public string? DematDocumentUrl { get; set; }
    public string? PhotoUrl { get; set; }
    public string? SignatureUrl { get; set; }

    // Review & Verification
    public string? ReviewRemarks { get; set; }
    public int? ReviewedByIrmId { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public DateTime? SubmittedAt { get; set; }

    public string? VerifiedBy { get; set; }
    public DateTime? VerifiedAt { get; set; }
    public string? Remarks { get; set; }
    public string? FlaggedSectionsJson { get; set; }

    /// <summary>
    /// JSON blob storing per-section IRM review drafts: { aadhaar: { status, reason }, pan: { ... }, bank: { ... } }
    /// Written by PATCH /api/irm/kyc/{id}/verification. Informational only; does not alter KycStatus.
    /// </summary>
    public string? SectionVerificationsJson { get; set; }

    // Public KYC link (for customer self-fill)
    public string? KycLinkToken { get; set; }
    public string? KycTokenHash { get; set; }
    public DateTime? KycLinkExpiresAt { get; set; }
    public bool KycLinkSent { get; set; } = false;
    /// <summary>Timestamp of the most recent successful KYC link dispatch (or resend).</summary>
    public DateTime? KycLinkSentAt { get; set; }
    public bool IsRevoked { get; set; } = false;
    public DateTime? RevokedAt { get; set; }

    // Assisted KYC Details & Customer Consent Audit
    public bool IsAssisted { get; set; } = false;
    public int? AssistedByUserId { get; set; }
    public bool CustomerConsentObtained { get; set; } = false;
    public DateTime? CustomerConsentTimestamp { get; set; }
    public string? CustomerConsentDetails { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
