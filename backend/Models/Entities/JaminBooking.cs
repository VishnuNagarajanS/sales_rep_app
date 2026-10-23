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

    public int? CustomerId { get; set; }
    public Customer? Customer { get; set; }

    public int? LeadId { get; set; }
    public Lead? Lead { get; set; }

    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;

    /// <summary>Project name denormalised for fast display.</summary>
    public string ProjectName { get; set; } = string.Empty;

    /// <summary>Plot label denormalised, e.g. "Plot #22".</summary>
    public string PlotNumber { get; set; } = string.Empty;

    /// <summary>Base price of the plot before extra charges or discounts.</summary>
    public decimal BasePrice { get; set; }

    /// <summary>Development, club house, or statutory charges.</summary>
    public decimal DevelopmentCharges { get; set; }

    /// <summary>Approved commercial or early-bird discounts.</summary>
    public decimal ApprovedDiscounts { get; set; }

    /// <summary>Total agreed contract price for the plot (BasePrice + DevelopmentCharges - ApprovedDiscounts).</summary>
    public decimal TotalPlotPrice { get; set; }

    /// <summary>Token / advance amount recorded.</summary>
    public decimal TokenAmountPaid { get; set; }

    /// <summary>Bank Transfer / NEFT / RTGS / UPI / Cheque.</summary>
    public string PaymentMode { get; set; } = "Bank Transfer / NEFT";

    /// <summary>Installment terms / milestones (e.g. 20% advance, 80% on registration).</summary>
    public string? PaymentTerms { get; set; }

    /// <summary>Hold | Pending Verification | Token Verified | Agreement Signed | Registration Completed | Cancelled | Voided</summary>
    public string Status { get; set; } = "Pending Verification";

    /// <summary>Pending | Partially Paid | Verified | Refunded | Failed</summary>
    public string PaymentStatus { get; set; } = "Pending";

    /// <summary>If on temporary hold, when the hold expires.</summary>
    public DateTime? HoldExpiresAt { get; set; }

    public DateTime BookingDate { get; set; } = DateTime.UtcNow;

    public int? AssignedAgentId { get; set; }
    public User? AssignedAgent { get; set; }
    public string AssignedAgentName { get; set; } = string.Empty;

    // Cancellation & Refund Audit
    public DateTime? CancelledAt { get; set; }
    public int? CancelledByUserId { get; set; }
    public User? CancelledByUser { get; set; }
    public string? CancelledByName { get; set; }
    public string? CancellationReason { get; set; }
    public decimal RefundAmount { get; set; }

    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public ICollection<JaminPayment> Payments { get; set; } = new List<JaminPayment>();
}
