namespace backend.DTOs.GhlDeals;

// ── Request DTOs ─────────────────────────────────────────────────────────────

public class CreateGhlDealDto
{
    public string Title { get; set; } = string.Empty;
    public int? CustomerId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string Stage { get; set; } = "new";
    public decimal Value { get; set; } = 0;
    public string ExpectedCloseDate { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;
    public string? InvestorType { get; set; }
    public string? InvestmentRange { get; set; }
    public string? PreferredAssetClass { get; set; }
    public string Priority { get; set; } = "Medium";
}

public class UpdateGhlDealDto
{
    public string? Title { get; set; }
    public string? Stage { get; set; }
    public decimal? Value { get; set; }
    public string? ExpectedCloseDate { get; set; }
    public string? Notes { get; set; }
    public string? LostReason { get; set; }
    public string? InvestorType { get; set; }
    public string? InvestmentRange { get; set; }
    public string? PreferredAssetClass { get; set; }
    public string? Priority { get; set; }
    public DateTime? StageEnteredAt { get; set; }
}

public class LogGhlDealActivityDto
{
    /// <summary>note | call | whatsapp | meeting | stage_change</summary>
    public string Type { get; set; } = "note";
    public string Text { get; set; } = string.Empty;
    public string? FromStage { get; set; }
    public string? ToStage { get; set; }
    public string LoggedByName { get; set; } = string.Empty;
    public string LoggedByRole { get; set; } = string.Empty;
}

// ── Response DTOs ────────────────────────────────────────────────────────────

public class GhlDealResponseDto
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public int AssignedAgentId { get; set; }
    public string? AssignedAgentName { get; set; }
    public string Title { get; set; } = string.Empty;
    public int? CustomerId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string Stage { get; set; } = string.Empty;
    public decimal Value { get; set; }
    public string ExpectedCloseDate { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;
    public string? LostReason { get; set; }
    public string? InvestorType { get; set; }
    public string? InvestmentRange { get; set; }
    public string? PreferredAssetClass { get; set; }
    public string Priority { get; set; } = string.Empty;
    public DateTime? StageEnteredAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class GhlDealActivityResponseDto
{
    public int Id { get; set; }
    public int DealId { get; set; }
    public int CompanyId { get; set; }
    public string Type { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    public string? FromStage { get; set; }
    public string? ToStage { get; set; }
    public string LoggedByName { get; set; } = string.Empty;
    public string LoggedByRole { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public DateTime CreatedAt { get; set; }
}
