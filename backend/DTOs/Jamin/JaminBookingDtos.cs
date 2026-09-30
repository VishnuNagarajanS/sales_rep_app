namespace backend.DTOs.Jamin;

// ── Response DTOs ────────────────────────────────────────────────────────────

public class JaminBookingResponseDto
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public int? ProjectId { get; set; }
    public int? PlotId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string ProjectName { get; set; } = string.Empty;
    public string PlotNumber { get; set; } = string.Empty;
    public decimal TotalPlotPrice { get; set; }
    public decimal TokenAmountPaid { get; set; }
    public string PaymentMode { get; set; } = "Bank Transfer / NEFT";
    public string Status { get; set; } = "Token Paid";
    public DateTime BookingDate { get; set; }
    public int? AssignedAgentId { get; set; }
    public string AssignedAgentName { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

// ── Request DTOs ─────────────────────────────────────────────────────────────

public class CreateJaminBookingDto
{
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public int? ProjectId { get; set; }
    public int? PlotId { get; set; }
    public string? ProjectName { get; set; }
    public string? PlotNumber { get; set; }
    public decimal TotalPlotPrice { get; set; }
    public decimal TokenAmountPaid { get; set; }
    public string? PaymentMode { get; set; }
    public int? AssignedAgentId { get; set; }
    public string? Notes { get; set; }
}

public class UpdateJaminBookingStatusDto
{
    /// <summary>Token Paid | Agreement Signed | Registration Completed | Cancelled.</summary>
    public string Status { get; set; } = string.Empty;
    public string? Notes { get; set; }
}
