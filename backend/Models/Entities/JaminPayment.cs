namespace backend.Models.Entities;

/// <summary>
/// Immutable payment ledger entry for Jamin plot bookings.
/// Tracks token advances, installment payments, and refund transactions with verification audit.
/// </summary>
public class JaminPayment
{
    public int Id { get; set; }

    public int CompanyId { get; set; }
    public Tenant? Company { get; set; }

    public int BookingId { get; set; }
    public JaminBooking? Booking { get; set; }

    public int? CustomerId { get; set; }
    public Customer? Customer { get; set; }

    public int? LeadId { get; set; }
    public Lead? Lead { get; set; }

    /// <summary>Positive transaction amount.</summary>
    public decimal Amount { get; set; }

    /// <summary>Token | Installment | Registration | Refund | Adjustment</summary>
    public string PaymentType { get; set; } = "Token";

    /// <summary>Bank Transfer / NEFT | RTGS | Cheque / DD | UPI / Online | Cash</summary>
    public string PaymentMode { get; set; } = "Bank Transfer / NEFT";

    /// <summary>Bank UTR, Cheque Number, UPI Ref, etc.</summary>
    public string TransactionReference { get; set; } = string.Empty;

    /// <summary>Pending | Verified | Failed | Cancelled</summary>
    public string Status { get; set; } = "Pending";

    public DateTime? VerifiedAt { get; set; }
    public int? VerifiedByUserId { get; set; }
    public User? VerifiedByUser { get; set; }
    public string? VerifiedByName { get; set; }

    /// <summary>Receipt voucher reference, e.g. RCP-2026-00042</summary>
    public string? ReceiptNumber { get; set; }

    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
