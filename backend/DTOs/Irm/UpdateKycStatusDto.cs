using System.Collections.Generic;

namespace backend.DTOs.Irm;

public class KycChecklistDto
{
    public bool Identity { get; set; }
    public bool Bank { get; set; }
    public bool Documents { get; set; }
    public bool Nominee { get; set; }
    public bool Demat { get; set; }

    public bool IsAllChecked => Identity && Bank && Documents && Nominee && Demat;

    /// <summary>
    /// Validates checklist completion. Nominee is optional when no nominee was submitted.
    /// </summary>
    public bool IsValid(bool hasNominee) => Identity && Bank && Documents && Demat && (!hasNominee || Nominee);
}

public class UpdateKycStatusDto
{
    public string Status { get; set; } = null!;
    public string? Comment { get; set; }
    public List<string>? FlaggedSections { get; set; }
    public KycChecklistDto? Checklist { get; set; }
}

/// <summary>
/// Per-section draft mark used by PATCH /api/irm/kyc/{id}/verification
/// </summary>
public class SectionVerificationDto
{
    /// <summary>"unchecked" | "verified" | "wrong"</summary>
    public string Status { get; set; } = "unchecked";
    public string? Reason { get; set; }
}

/// <summary>
/// Payload for PATCH /api/irm/kyc/{id}/verification (section-level draft persistence).
/// </summary>
public class SaveVerificationDraftDto
{
    public SectionVerificationDto? Aadhaar { get; set; }
    public SectionVerificationDto? Pan { get; set; }
    public SectionVerificationDto? Bank { get; set; }
}
