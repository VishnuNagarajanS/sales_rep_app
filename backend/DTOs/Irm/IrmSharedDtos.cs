namespace backend.DTOs.Irm;

// ── Followup DTOs ─────────────────────────────────────────────────────────────

public class FollowupDto
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public int? InvestorId { get; set; }
    public string? InvestorName { get; set; }
    public int AssignedToId { get; set; }
    public string AssignedToName { get; set; } = string.Empty;
    public string AssignedToRole { get; set; } = string.Empty;
    public string ContactName { get; set; } = string.Empty;
    public string ContactPhone { get; set; } = string.Empty;
    public string? ContactEmail { get; set; }
    public string? Email => ContactEmail;
    public string? ContactId { get; set; }
    public DateTime ScheduledAt { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? Agenda { get; set; }
    public string? OutcomeNotes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime? RescheduledTo { get; set; }
    public int? HandoverId { get; set; }
    public string? HandedOverFromName { get; set; }
    public DateTime? HandoverPlannedEnd { get; set; }
    public int? OriginalOwnerId { get; set; }
}

public class CreateFollowupDto
{
    public int? InvestorId { get; set; }
    public string ContactName { get; set; } = string.Empty;
    public string ContactPhone { get; set; } = string.Empty;
    public string? ContactEmail { get; set; }
    public string? ContactId { get; set; }
    public DateTime ScheduledAt { get; set; }
    public string? Agenda { get; set; }
}

public class CompleteFollowupDto
{
    public string OutcomeNotes { get; set; } = string.Empty;
}

public class RescheduleFollowupDto
{
    public DateTime NewScheduledAt { get; set; }
    public string? Reason { get; set; }
}

// ── IRM Pipeline DTOs ─────────────────────────────────────────────────────────

public class IrmPipelineCardDto
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public int InvestorId { get; set; }
    public int AssignedIrmId { get; set; }
    public string AssignedIrmName { get; set; } = string.Empty;
    public string InvestorName { get; set; } = string.Empty;
    public string InvestorPhone { get; set; } = string.Empty;
    public string InvestorEmail { get; set; } = string.Empty;
    public string StageId { get; set; } = string.Empty;
    public DateTime StageEnteredAt { get; set; }
    public string? LastActionSnippet { get; set; }
    public DateTime? LastActivityDate { get; set; }
    public string Priority { get; set; } = string.Empty;
    public decimal? Value { get; set; }
    public string? InvestmentAmount { get; set; }
    public string? PreferredAssetClass { get; set; }
    public string? ActivityLogsJson { get; set; }
    public DateTime CreatedAt { get; set; }

    public int? HandoverId { get; set; }
    public string? HandedOverFromName { get; set; }
    public DateTime? HandoverPlannedEnd { get; set; }
    public int? OriginalOwnerId { get; set; }
}

public class IrmPipelineBoardDto
{
    public List<IrmPipelineStageDto> Stages { get; set; } = new();
}

public class IrmPipelineStageDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Color { get; set; } = string.Empty;
    public List<IrmPipelineCardDto> Cards { get; set; } = new();
}

public class MoveIrmStageDto
{
    /// <summary>Target stage: leads | followup | qualified_investor | investment_opportunity | converted</summary>
    public string TargetStageId { get; set; } = string.Empty;
}

public class LogIrmActivityDto
{
    public string Type { get; set; } = string.Empty;   // call | note | stage_change | meeting | whatsapp
    public string Details { get; set; } = string.Empty;
}

// ── IRM Dashboard DTOs ────────────────────────────────────────────────────────

public class IrmDashboardMetricsDto
{
    public decimal TotalCommittedAum { get; set; }
    public int ActiveInvestors { get; set; }
    public int PendingKycReviews { get; set; }
    public int ConsultationsToday { get; set; }
    public int PendingFollowups { get; set; }
    public int TotalInvestors { get; set; }
    public int OpportunitiesOpen { get; set; }
}

// ── IRM Call Log DTOs ─────────────────────────────────────────────────────────

public class LogCallDto
{
    public int InvestorId { get; set; }
    public string InvestorName { get; set; } = string.Empty;
    public string InvestorPhone { get; set; } = string.Empty;
    public int DurationSeconds { get; set; }
    /// <summary>Interested | NotInterested | Callback | MandateDiscussed | NoAnswer | Voicemail | WrongNumber | Other</summary>
    public string Outcome { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public string? Reason { get; set; }
    public string? Module { get; set; }
    public string? RecordingUrl { get; set; }
}

public class CallLogDto
{
    public int Id { get; set; }
    public int InvestorId { get; set; }
    public string InvestorName { get; set; } = string.Empty;
    public string InvestorPhone { get; set; } = string.Empty;
    public int IrmId { get; set; }
    public string IrmName { get; set; } = string.Empty;
    public DateTime CalledAt { get; set; }
    public int DurationSeconds { get; set; }
    public string Outcome { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public string? Reason { get; set; }
    public string? Module { get; set; }
    public string? RecordingUrl { get; set; }
}

// ── IRM Other Module DTOs ─────────────────────────────────────────────────────

public class IrmOtherRecordDto
{
    public int CallId { get; set; }
    public int? CustomerId { get; set; }
    public int? LeadId { get; set; }
    public string ContactName { get; set; } = string.Empty;
    public string ContactPhone { get; set; } = string.Empty;
    public string? ContactEmail { get; set; }
    public string CallModule { get; set; } = string.Empty;
    public string ModuleDisplayName { get; set; } = string.Empty;
    public string Disposition { get; set; } = "Other";
    public string Reason { get; set; } = string.Empty;
    public int AgentId { get; set; }
    public string AgentName { get; set; } = string.Empty;
    public int CompanyId { get; set; }
    public string CompanyName { get; set; } = string.Empty;
    public DateTime LastCallAt { get; set; }
    public int Duration { get; set; }
}

public class ContactOtherMatcher
{
    public HashSet<string> PhoneKeys { get; } = new(StringComparer.OrdinalIgnoreCase);
    public HashSet<int> CustomerIds { get; } = new();
    public HashSet<int> LeadIds { get; } = new();
    public HashSet<string> NameKeys { get; } = new(StringComparer.OrdinalIgnoreCase);

    public bool HasAnyOther => PhoneKeys.Count > 0 || CustomerIds.Count > 0 || LeadIds.Count > 0 || NameKeys.Count > 0;

    public bool IsInOther(string? phone, int? customerId = null, int? leadId = null, string? name = null)
    {
        if (customerId.HasValue && customerId.Value > 0 && CustomerIds.Contains(customerId.Value))
            return true;
        if (leadId.HasValue && leadId.Value > 0 && LeadIds.Contains(leadId.Value))
            return true;
        var cleanPhone = NormalizeDigits(phone);
        if (!string.IsNullOrEmpty(cleanPhone) && PhoneKeys.Contains(cleanPhone))
            return true;
        var cleanName = NormalizeString(name);
        if (!string.IsNullOrEmpty(cleanName) && NameKeys.Contains(cleanName))
            return true;
        return false;
    }

    public static string? NormalizeDigits(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone)) return null;
        var digits = new string(phone.Where(char.IsDigit).ToArray());
        if (digits.Length >= 10) return digits[^10..];
        if (digits.Length >= 7) return digits;
        return null;
    }

    public static string? NormalizeString(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        var clean = text.Trim().ToLowerInvariant();
        return string.IsNullOrEmpty(clean) ? null : clean;
    }
}
