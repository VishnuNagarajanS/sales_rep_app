namespace backend.DTOs.Jamin;

// ── Response DTOs ────────────────────────────────────────────────────────────

public class JaminPlotResponseDto
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public int ProjectId { get; set; }
    public string PlotNumber { get; set; } = string.Empty;
    public string Dimensions { get; set; } = "30 x 40";
    public int AreaSqFt { get; set; }
    public string Facing { get; set; } = "East";
    public string Status { get; set; } = "Available";
    public decimal Price { get; set; }
    public decimal PricePerSqft { get; set; }
    public string? HeldByCustomerName { get; set; }
    public string? HeldByCustomerPhone { get; set; }
    public string? HoldByAgent { get; set; }
    public DateTime? HoldExpiresAt { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

// ── Request DTOs ─────────────────────────────────────────────────────────────

public class CreateJaminPlotDto
{
    public int ProjectId { get; set; }
    public string PlotNumber { get; set; } = string.Empty;
    public string? Dimensions { get; set; } = "30 x 40";
    public int AreaSqFt { get; set; } = 1200;
    public string? Facing { get; set; } = "East";
    public decimal Price { get; set; }
    public decimal? PricePerSqft { get; set; }
    public string? Notes { get; set; }
}

public class HoldPlotRequestDto
{
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string? HoldByAgent { get; set; }
    public int HoldDays { get; set; } = 7;
    public string? Notes { get; set; }
}

public class UpdateJaminPlotDto
{
    public string? PlotNumber { get; set; }
    public string? Dimensions { get; set; }
    public int? AreaSqFt { get; set; }
    public string? Facing { get; set; }
    public string? Status { get; set; }
    public decimal? Price { get; set; }
    public decimal? PricePerSqft { get; set; }
    public string? HoldByAgent { get; set; }
    public string? Notes { get; set; }
}
