namespace backend.DTOs.Jamin;

// ── Response DTOs ────────────────────────────────────────────────────────────

public class JaminPaymentResponseDto
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public int BookingId { get; set; }
    public int? CustomerId { get; set; }
    public int? LeadId { get; set; }
    public decimal Amount { get; set; }
    public string PaymentType { get; set; } = "Token";
    public string PaymentMode { get; set; } = "Bank Transfer / NEFT";
    public string TransactionReference { get; set; } = string.Empty;
    public string Status { get; set; } = "Pending";
    public DateTime? VerifiedAt { get; set; }
    public int? VerifiedByUserId { get; set; }
    public string? VerifiedByName { get; set; }
    public string? ReceiptNumber { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class JaminBookingResponseDto
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public int? CustomerId { get; set; }
    public int? LeadId { get; set; }
    public int? ProjectId { get; set; }
    public int? PlotId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string ProjectName { get; set; } = string.Empty;
    public string PlotNumber { get; set; } = string.Empty;

    // Pricing & Financials
    public decimal BasePrice { get; set; }
    public decimal DevelopmentCharges { get; set; }
    public decimal ApprovedDiscounts { get; set; }
    public decimal TotalPlotPrice { get; set; }
    public decimal TokenAmountPaid { get; set; }
    public string PaymentMode { get; set; } = "Bank Transfer / NEFT";
    public string? PaymentTerms { get; set; }

    // Statuses
    public string Status { get; set; } = "Pending Verification";
    public string PaymentStatus { get; set; } = "Pending";
    public DateTime? HoldExpiresAt { get; set; }

    public DateTime BookingDate { get; set; }
    public int? AssignedAgentId { get; set; }
    public string AssignedAgentName { get; set; } = string.Empty;

    // Cancellation Details
    public DateTime? CancelledAt { get; set; }
    public int? CancelledByUserId { get; set; }
    public string? CancelledByName { get; set; }
    public string? CancellationReason { get; set; }
    public decimal RefundAmount { get; set; }

    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    // Payment Ledger
    public List<JaminPaymentResponseDto> Payments { get; set; } = new();

    // Derived Financial Metrics
    public decimal ContractValue => TotalPlotPrice;
    public decimal VerifiedReceipts { get; set; }
    public decimal TotalRefunds { get; set; }
    public decimal NetCashReceived { get; set; }
    public decimal ContractBalance { get; set; }
}

// ── Request DTOs ─────────────────────────────────────────────────────────────

public class CreateJaminBookingDto
{
    public int? CustomerId { get; set; }
    public int? LeadId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public int? ProjectId { get; set; }
    public int? PlotId { get; set; }
    public string? ProjectName { get; set; }
    public string? PlotNumber { get; set; }

    public decimal? BasePrice { get; set; }
    public decimal? DevelopmentCharges { get; set; }
    public decimal? ApprovedDiscounts { get; set; }
    public decimal TotalPlotPrice { get; set; }
    public decimal TokenAmountPaid { get; set; }

    public string? PaymentMode { get; set; }
    public string? TransactionReference { get; set; }
    public string? ReceiptNumber { get; set; }
    public string? PaymentTerms { get; set; }
    public int? AssignedAgentId { get; set; }
    public string? Notes { get; set; }

    /// <summary>Set to true if this is an expiring Hold reservation rather than immediate token booking.</summary>
    public bool IsHold { get; set; }
    public int HoldDays { get; set; } = 2;
}

public class UpdateJaminBookingStatusDto
{
    /// <summary>Token Verified | Agreement Signed | Registration Completed | Cancelled.</summary>
    public string Status { get; set; } = string.Empty;
    public decimal? TokenAmountPaid { get; set; }
    public string? PaymentMode { get; set; }
    public string? PaymentTerms { get; set; }
    public string? Notes { get; set; }
}

public class VerifyBookingPaymentRequestDto
{
    public int? PaymentId { get; set; }
    public string? ReceiptNumber { get; set; }
    public string? Notes { get; set; }
}

public class CancelBookingRequestDto
{
    public string CancellationReason { get; set; } = string.Empty;
    public decimal RefundAmount { get; set; } = 0;
    public string? RefundPaymentMode { get; set; }
    public string? RefundTransactionReference { get; set; }
    public string? Notes { get; set; }
}

public class AddBookingPaymentRequestDto
{
    public decimal Amount { get; set; }
    public string PaymentType { get; set; } = "Installment"; // Token, Installment, Registration, Refund
    public string PaymentMode { get; set; } = "Bank Transfer / NEFT";
    public string TransactionReference { get; set; } = string.Empty;
    public string? ReceiptNumber { get; set; }
    public string? Notes { get; set; }
}
