namespace backend.DTOs.Jamin;

// ── Response DTOs ────────────────────────────────────────────────────────────

public class JaminProjectResponseDto
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public string Status { get; set; } = "Active";
    public string Description { get; set; } = string.Empty;
    public int TotalPlots { get; set; }
    public int AvailablePlots { get; set; }
    public int BookedPlots { get; set; }
    public string PriceRange { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

// ── Request DTOs ─────────────────────────────────────────────────────────────

public class CreateJaminProjectDto
{
    public string Name { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public string? Status { get; set; } = "Active";
    public string? Description { get; set; }
    public int TotalPlots { get; set; }
    public string? PriceRange { get; set; }
    public string? ImageUrl { get; set; }
}

public class UpdateJaminProjectDto
{
    public string? Name { get; set; }
    public string? Location { get; set; }
    public string? Status { get; set; }
    public string? Description { get; set; }
    public int? TotalPlots { get; set; }
    public int? AvailablePlots { get; set; }
    public int? BookedPlots { get; set; }
    public string? PriceRange { get; set; }
    public string? ImageUrl { get; set; }
}
