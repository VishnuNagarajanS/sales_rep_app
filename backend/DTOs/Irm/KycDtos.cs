namespace backend.DTOs.Irm;

// ── KYC DTOs ─────────────────────────────────────────────────────────────────

public class KycDto
{
    public int Id { get; set; }
    public int InvestorId { get; set; }
    public int CompanyId { get; set; }
    public int? IrmId { get; set; }
    public string Status { get; set; } = string.Empty;

    // Step 1
    public string InvestorName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? FatherName { get; set; }
    public string? DateOfBirth { get; set; }
    public string? NameAsPerPan { get; set; }
    public string Gender { get; set; } = string.Empty;
    public string InvestorType { get; set; } = string.Empty;
    public string ResidentType { get; set; } = string.Empty;
    public string? Occupation { get; set; }

    // Step 2
    public string? PanNumber { get; set; }
    public string? AadhaarNumber { get; set; }
    public string? AddressLine1 { get; set; }
    public string? AddressLine2 { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Pincode { get; set; }
    public string? Country { get; set; }

    // Step 3
    public string? BankName { get; set; }
    public string? AccountNumber { get; set; }
    public string? IfscCode { get; set; }
    public string? AccountType { get; set; }
    public string? DematAccountNumber { get; set; }
    public string? DpId { get; set; }

    // Step 4 - Nominees as JSON
    public string? NomineesJson { get; set; }

    // Step 5 - Document URLs
    public string? PanDocumentUrl { get; set; }
    public string? AadhaarDocumentUrl { get; set; }
    public string? BankChequeUrl { get; set; }
    public string? DematDocumentUrl { get; set; }
    public string? PhotoUrl { get; set; }
    public string? SignatureUrl { get; set; }

    // Document indicators
    public bool HasPanDocument => !string.IsNullOrWhiteSpace(PanDocumentUrl);
    public bool HasAadhaarDocument => !string.IsNullOrWhiteSpace(AadhaarDocumentUrl);
    public bool HasPhoto => !string.IsNullOrWhiteSpace(PhotoUrl);

    // Review
    public string? ReviewRemarks { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? VerifiedBy { get; set; }
    public DateTime? VerifiedAt { get; set; }
    public string? Remarks { get; set; }
    public string? FlaggedSections { get; set; }
    public bool KycLinkSent { get; set; }
    public DateTime? KycLinkSentAt { get; set; }
    public DateTime? SubmittedAt { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class KycListDto
{
    public int Id { get; set; }
    public int InvestorId { get; set; }
    public int CompanyId { get; set; }
    public int? IrmId { get; set; }
    public string Status { get; set; } = string.Empty;

    // Step 1
    public string InvestorName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? FatherName { get; set; }
    public string? DateOfBirth { get; set; }
    public string? NameAsPerPan { get; set; }
    public string Gender { get; set; } = string.Empty;
    public string InvestorType { get; set; } = string.Empty;
    public string ResidentType { get; set; } = string.Empty;
    public string? Occupation { get; set; }

    // Step 2
    public string? PanNumber { get; set; }
    public string? AadhaarNumber { get; set; }
    public string? AddressLine1 { get; set; }
    public string? AddressLine2 { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Pincode { get; set; }
    public string? Country { get; set; }

    // Step 3
    public string? BankName { get; set; }
    public string? AccountNumber { get; set; }
    public string? IfscCode { get; set; }
    public string? AccountType { get; set; }
    public string? DematAccountNumber { get; set; }
    public string? DpId { get; set; }

    // Step 4 - Nominees as JSON
    public string? NomineesJson { get; set; }

    // Document booleans (performance: omit heavy base64 strings in list)
    public bool HasPanDocument { get; set; }
    public bool HasAadhaarDocument { get; set; }
    public bool HasPhoto { get; set; }

    // Review
    public string? ReviewRemarks { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? VerifiedBy { get; set; }
    public DateTime? VerifiedAt { get; set; }
    public string? Remarks { get; set; }
    public string? FlaggedSections { get; set; }
    public bool KycLinkSent { get; set; }
    public DateTime? KycLinkSentAt { get; set; }
    public DateTime? SubmittedAt { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class SendKycLinkDto
{
    public int? InvestorId { get; set; }
    public string? CustomerName { get; set; }
    public string Phone { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string Channel { get; set; } = "email";
    public string Expiry { get; set; } = "48h";
    public string? BaseUrl { get; set; }
}

public class SendKycLinkResponseDto
{
    public string Token { get; set; } = string.Empty;
    public string Link { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public bool EmailSent { get; set; }
    public string DeliveryStatus { get; set; } = string.Empty;
}

public class SubmitKycDto
{
    public string? Token { get; set; }
    public int InvestorId { get; set; }

    // Step 1
    public string InvestorName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? FatherName { get; set; }
    public string? DateOfBirth { get; set; }
    public string? Dob { get; set; }
    public string? NameAsPerPan { get; set; }
    public string Gender { get; set; } = string.Empty;
    public string InvestorType { get; set; } = string.Empty;
    public string ResidentType { get; set; } = string.Empty;
    public string? Occupation { get; set; }

    // Step 2
    public string? PanNumber { get; set; }
    public string? AadhaarNumber { get; set; }
    public string? AddressLine1 { get; set; }
    public string? AddressLine2 { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Pincode { get; set; }
    public string? Country { get; set; }

    // Step 3
    public string? BankName { get; set; }
    public string? AccountNumber { get; set; }
    public string? IfscCode { get; set; }
    public string? AccountType { get; set; }
    public string? DematAccountNumber { get; set; }
    public string? DpId { get; set; }

    // Step 4 - Nominees as JSON string (serialized NomineeItem[])
    public string? NomineesJson { get; set; }

    // Step 5 - Documents
    public string? PanDocumentUrl { get; set; }
    public string? AadhaarDocumentUrl { get; set; }
    public string? BankChequeUrl { get; set; }
    public string? DematDocumentUrl { get; set; }
    public string? PhotoUrl { get; set; }
    public string? SignatureUrl { get; set; }

    // Whether this is a final submit (true) or a draft save (false)
    public bool IsFinalSubmit { get; set; } = false;
}

public class KycReviewDto
{
    /// <summary>Approved | Rejected | ReuploadRequested</summary>
    public string Action { get; set; } = string.Empty;
    public string? Remarks { get; set; }
}

// ── KYC OTP DTOs ─────────────────────────────────────────────────────────────

public class SendKycOtpRequestDto
{
    public string Token { get; set; } = string.Empty;
    public string? Email { get; set; }
}

public class SendKycOtpResponseDto
{
    public bool Success { get; set; }
    public string MaskedEmail { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public int ExpiresInSeconds { get; set; } = 300;
}

public class VerifyKycOtpRequestDto
{
    public string Token { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string Otp { get; set; } = string.Empty;
}

public class VerifyKycOtpResponseDto
{
    public bool Verified { get; set; }
    public string Message { get; set; } = string.Empty;
}

