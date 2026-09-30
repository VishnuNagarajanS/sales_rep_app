namespace backend.Models.Entities;

/// <summary>
/// Jamin Bazaar — Plot Booking / Sale Agreement.
/// Tracks the lifecycle: Token Paid → Agreement Signed → Registration Completed.
/// </summary>
public class JaminBooking
{
    public int Id { get; set; }

    public int CompanyId { get; set; }
    public Tenant? Company { get; set; }

    public int? ProjectId { get; set; }
    public JaminProject? Project { get; set; }

    public int? PlotId { get; set; }
    public JaminPlot? Plot { get; set; }

    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;

    /// <summary>Project name denormalised for fast display.</summary>
    public string ProjectName { get; set; } = string.Empty;

    /// <summary>Plot label denormalised, e.g. "Plot #22".</summary>
    public string PlotNumber { get; set; } = string.Empty;

    /// <summary>Total agreed price for the plot.</summary>
    public decimal TotalPlotPrice { get; set; }

    /// <summary>Token / advance amount paid.</summary>
    public decimal TokenAmountPaid { get; set; }

    /// <summary>Bank Transfer / NEFT / RTGS / UPI / Cheque.</summary>
    public string PaymentMode { get; set; } = "Bank Transfer / NEFT";

    /// <summary>Token Paid | Agreement Signed | Registration Completed | Cancelled.</summary>
    public string Status { get; set; } = "Token Paid";

    public DateTime BookingDate { get; set; } = DateTime.UtcNow;

    public int? AssignedAgentId { get; set; }
    public User? AssignedAgent { get; set; }
    public string AssignedAgentName { get; set; } = string.Empty;

    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
