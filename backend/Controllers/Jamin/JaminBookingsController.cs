using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.Jamin;
using backend.Extensions;
using backend.Models.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers.Jamin;

[ApiController]
[Route("api/jamin/bookings")]
[Authorize]
public class JaminBookingsController : JaminTenantControllerBase
{
    private static readonly string[] ActiveReservingStatuses = 
    { 
        "Hold", "Pending Verification", "Booking Pending Verification", "Token Paid", "Token Verified", "Agreement Signed", "Registration Completed" 
    };

    private static readonly string[] BookingStatuses = 
    { 
        "Hold", "Hold Expired", "Pending Verification", "Booking Pending Verification", "Token Paid", "Token Verified", "Agreement Signed", "Registration Completed", "Cancelled", "Voided" 
    };

    private readonly ApplicationDbContext _db;
    public JaminBookingsController(ApplicationDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetBookings([FromQuery] int? leadId, [FromQuery] int? customerId, CancellationToken ct)
    {
        try
        {
            var companyId = JaminCompanyId;
            var query = _db.JaminBookings
                .AsNoTracking()
                .Include(b => b.Payments)
                .Where(b => b.CompanyId == companyId);

            if (leadId.HasValue && leadId.Value > 0)
                query = query.Where(b => b.LeadId == leadId.Value);
            if (customerId.HasValue && customerId.Value > 0)
                query = query.Where(b => b.CustomerId == customerId.Value);

            var bookings = (await query.OrderByDescending(b => b.BookingDate).ToListAsync(ct)).Select(ToDto).ToList();
            return Ok(ApiResponse<List<JaminBookingResponseDto>>.SuccessResult(bookings));
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[JaminBookingsController GetBookings Error] {ex.Message}");
            return Ok(ApiResponse<List<JaminBookingResponseDto>>.SuccessResult(new List<JaminBookingResponseDto>()));
        }
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetBooking(int id, CancellationToken ct)
    {
        var booking = await _db.JaminBookings
            .AsNoTracking()
            .Include(b => b.Payments)
            .FirstOrDefaultAsync(b => b.Id == id && b.CompanyId == JaminCompanyId, ct);

        return booking == null 
            ? NotFound(ApiResponse<JaminBookingResponseDto>.FailureResult("Booking not found."))
            : Ok(ApiResponse<JaminBookingResponseDto>.SuccessResult(ToDto(booking)));
    }

    [HttpPost]
    public async Task<IActionResult> CreateBooking([FromBody] CreateJaminBookingDto dto, CancellationToken ct)
    {
        var companyId = JaminCompanyId;
        if (string.IsNullOrWhiteSpace(dto.CustomerName) || string.IsNullOrWhiteSpace(dto.CustomerPhone) ||
            dto.TotalPlotPrice < 0 || dto.TokenAmountPaid < 0)
            return BadRequest(ApiResponse<JaminBookingResponseDto>.FailureResult("Customer details and valid non-negative booking amounts are required."));
        if (!dto.PlotId.HasValue || dto.PlotId.Value <= 0)
            return BadRequest(ApiResponse<JaminBookingResponseDto>.FailureResult("A plot must be selected before creating a booking."));

        var strategy = _db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync<IActionResult>(async () =>
        {
            _db.ChangeTracker.Clear();
            await using var transaction = await _db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct);

            JaminPlot? plot = null;
            JaminProject? project = null;
            if (dto.PlotId.HasValue)
            {
                plot = await _db.JaminPlots.FirstOrDefaultAsync(p => p.Id == dto.PlotId && p.CompanyId == companyId, ct);
                if (plot == null) return BadRequest(ApiResponse<JaminBookingResponseDto>.FailureResult("Plot not found."));
                if (plot.Status is "Registered" or "Sold")
                    return Conflict(ApiResponse<JaminBookingResponseDto>.FailureResult("This plot has already been registered or sold."));

                // Expire any outdated hold on the plot first
                if (plot.Status == "Hold" && plot.HoldExpiresAt <= DateTime.UtcNow)
                {
                    plot.Status = "Available"; plot.HeldByCustomerId = null; plot.HeldByCustomerName = null; 
                    plot.HeldByCustomerPhone = null; plot.HoldByAgent = null; plot.HoldExpiresAt = null;
                }

                // Check for existing active bookings blocking this plot
                var hasActiveBooking = await _db.JaminBookings.AnyAsync(
                    b => b.PlotId == plot.Id && b.CompanyId == companyId && ActiveReservingStatuses.Contains(b.Status), ct);

                if (hasActiveBooking)
                    return Conflict(ApiResponse<JaminBookingResponseDto>.FailureResult("This plot already has an active reservation or booking."));

                if (plot.Status != "Available" && !(plot.Status == "Hold" && plot.HeldByCustomerPhone == dto.CustomerPhone.Trim()))
                    return Conflict(ApiResponse<JaminBookingResponseDto>.FailureResult("Plot is not available for this buyer."));

                project = await _db.JaminProjects.FirstOrDefaultAsync(p => p.Id == plot.ProjectId && p.CompanyId == companyId, ct);
            }

            var basePrice = dto.BasePrice ?? (plot?.Price ?? dto.TotalPlotPrice);
            var devCharges = dto.DevelopmentCharges ?? 0;
            var discounts = dto.ApprovedDiscounts ?? 0;
            var totalPrice = dto.TotalPlotPrice > 0 ? dto.TotalPlotPrice : (basePrice + devCharges - discounts);

            if (dto.TokenAmountPaid > totalPrice)
                return BadRequest(ApiResponse<JaminBookingResponseDto>.FailureResult("Token amount cannot exceed the total plot price."));

            // 1. Resolve Lead if provided or by phone
            Lead? matchedLead = null;
            if (dto.LeadId.HasValue && dto.LeadId.Value > 0)
            {
                matchedLead = await _db.Leads.FirstOrDefaultAsync(l => l.Id == dto.LeadId.Value && l.CompanyId == companyId, ct)
                           ?? await _db.Leads.FirstOrDefaultAsync(l => l.Id == dto.LeadId.Value, ct);
            }
            if (matchedLead == null && !string.IsNullOrWhiteSpace(dto.CustomerPhone))
            {
                matchedLead = await _db.Leads.FirstOrDefaultAsync(l => l.Phone == dto.CustomerPhone.Trim() && l.CompanyId == companyId, ct)
                           ?? await _db.Leads.FirstOrDefaultAsync(l => l.Phone == dto.CustomerPhone.Trim(), ct);
            }

            var agentId = dto.AssignedAgentId ?? matchedLead?.AssignedAgentId ?? User.GetUserId();
            var agent = agentId > 0 ? await _db.Users.FirstOrDefaultAsync(u => u.Id == agentId && u.CompanyId == companyId, ct) : null;

            // 2. Resolve existing Customer if provided or by phone (do NOT create new customer yet until token is verified!)
            Customer? customer = null;
            if (dto.CustomerId.HasValue && dto.CustomerId.Value > 0)
            {
                customer = await _db.Customers.FirstOrDefaultAsync(c => c.Id == dto.CustomerId.Value && c.CompanyId == companyId, ct);
            }
            if (customer == null && !string.IsNullOrWhiteSpace(dto.CustomerPhone))
            {
                customer = await _db.Customers.FirstOrDefaultAsync(c => c.Phone == dto.CustomerPhone.Trim() && c.CompanyId == companyId, ct);
            }

            var isHold = dto.IsHold;
            var initialBookingStatus = isHold ? "Hold" : "Pending Verification";
            var initialPaymentStatus = isHold ? "Pending" : "Pending";
            DateTime? holdExpires = isHold ? DateTime.UtcNow.AddDays(dto.HoldDays > 0 ? dto.HoldDays : 2) : null;

            var booking = new JaminBooking
            {
                CompanyId = companyId,
                ProjectId = project?.Id,
                PlotId = plot?.Id,
                CustomerId = customer?.Id,
                LeadId = matchedLead?.Id,
                CustomerName = dto.CustomerName.Trim(),
                CustomerPhone = dto.CustomerPhone.Trim(),
                ProjectName = project?.Name ?? dto.ProjectName?.Trim() ?? string.Empty,
                PlotNumber = plot?.PlotNumber ?? dto.PlotNumber?.Trim() ?? string.Empty,
                BasePrice = basePrice,
                DevelopmentCharges = devCharges,
                ApprovedDiscounts = discounts,
                TotalPlotPrice = totalPrice,
                TokenAmountPaid = dto.TokenAmountPaid,
                PaymentMode = !string.IsNullOrWhiteSpace(dto.PaymentMode) ? dto.PaymentMode.Trim() : "Bank Transfer / NEFT",
                PaymentTerms = dto.PaymentTerms?.Trim(),
                Status = initialBookingStatus,
                PaymentStatus = initialPaymentStatus,
                HoldExpiresAt = holdExpires,
                BookingDate = DateTime.UtcNow,
                AssignedAgentId = agent?.Id,
                AssignedAgentName = agent?.Name ?? string.Empty,
                Notes = dto.Notes?.Trim(),
                CreatedAt = DateTime.UtcNow
            };

            _db.JaminBookings.Add(booking);
            await _db.SaveChangesAsync(ct);

            // 3. Create initial Payment Ledger Record if token is entered
            if (dto.TokenAmountPaid > 0 && !isHold)
            {
                var initialPayment = new JaminPayment
                {
                    CompanyId = companyId,
                    BookingId = booking.Id,
                    CustomerId = customer?.Id,
                    LeadId = matchedLead?.Id,
                    Amount = dto.TokenAmountPaid,
                    PaymentType = "Token",
                    PaymentMode = booking.PaymentMode,
                    TransactionReference = dto.TransactionReference?.Trim() ?? string.Empty,
                    ReceiptNumber = dto.ReceiptNumber?.Trim(),
                    Status = "Pending", // Needs finance authorization to become Verified!
                    Notes = $"Token submission for {booking.PlotNumber} ({booking.ProjectName})",
                    CreatedAt = DateTime.UtcNow
                };
                _db.JaminPayments.Add(initialPayment);
                booking.Payments.Add(initialPayment);
                await _db.SaveChangesAsync(ct);
            }

            // 4. Update Plot Inventory
            if (plot != null)
            {
                if (isHold)
                {
                    plot.Status = "Hold";
                    plot.HeldByCustomerId = customer?.Id;
                    plot.HeldByCustomerName = booking.CustomerName;
                    plot.HeldByCustomerPhone = booking.CustomerPhone;
                    plot.HoldByAgent = booking.AssignedAgentName;
                    plot.HoldExpiresAt = holdExpires;
                }
                else
                {
                    plot.Status = "Booked";
                    plot.HeldByCustomerId = customer?.Id;
                    plot.HeldByCustomerName = booking.CustomerName;
                    plot.HeldByCustomerPhone = booking.CustomerPhone;
                    plot.HoldByAgent = booking.AssignedAgentName;
                    plot.HoldExpiresAt = null;
                }
                plot.UpdatedAt = DateTime.UtcNow;

                if (project != null) await RecalculateInventoryAsync(project, ct);
                await _db.SaveChangesAsync(ct);
            }

            // 5. Update linked lead status to Booking In Progress (until verified token converts it)
            if (matchedLead != null && matchedLead.Status != "Converted")
            {
                matchedLead.Status = "Booking In Progress";
                matchedLead.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync(ct);
            }

            await transaction.CommitAsync(ct);

            return CreatedAtAction(nameof(GetBooking), new { id = booking.Id },
                ApiResponse<JaminBookingResponseDto>.SuccessResult(ToDto(booking), 
                    isHold ? "Plot placed on temporary hold." : "Booking created. Payment verification pending."));
        });
    }

    /// <summary>
    /// Authorized Finance / Admin payment verification.
    /// Upon verified token receipt, converts Lead into an Active Customer with linked history.
    /// </summary>
    [HttpPost("{id:int}/verify-payment")]
    [Authorize(Roles = "company_admin,super_admin,sales_manager,admin")]
    public async Task<IActionResult> VerifyPayment(int id, [FromBody] VerifyBookingPaymentRequestDto dto, CancellationToken ct)
    {
        var companyId = JaminCompanyId;
        var currentUserId = User.GetUserId();
        var currentUserName = User.GetUserName() ?? "Finance Officer";

        var strategy = _db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync<IActionResult>(async () =>
        {
            _db.ChangeTracker.Clear();
            await using var transaction = await _db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct);

            var booking = await _db.JaminBookings
                .Include(b => b.Payments)
                .FirstOrDefaultAsync(b => b.Id == id && b.CompanyId == companyId, ct);

            if (booking == null) return NotFound(ApiResponse<JaminBookingResponseDto>.FailureResult("Booking not found."));
            if (booking.Status is "Cancelled" or "Voided")
                return Conflict(ApiResponse<JaminBookingResponseDto>.FailureResult("Cannot verify payment on a cancelled booking."));

            // Find payment to verify
            JaminPayment? payment = null;
            if (dto.PaymentId.HasValue && dto.PaymentId.Value > 0)
            {
                payment = booking.Payments.FirstOrDefault(p => p.Id == dto.PaymentId.Value);
            }
            if (payment == null)
            {
                payment = booking.Payments.FirstOrDefault(p => p.Status == "Pending");
            }

            if (payment == null && booking.TokenAmountPaid > 0)
            {
                // Create a payment record if legacy record didn't have one
                payment = new JaminPayment
                {
                    CompanyId = companyId,
                    BookingId = booking.Id,
                    CustomerId = booking.CustomerId,
                    LeadId = booking.LeadId,
                    Amount = booking.TokenAmountPaid,
                    PaymentType = "Token",
                    PaymentMode = booking.PaymentMode,
                    TransactionReference = "LEGACY-VERIFIED",
                    CreatedAt = DateTime.UtcNow
                };
                _db.JaminPayments.Add(payment);
                booking.Payments.Add(payment);
            }

            if (payment == null)
                return BadRequest(ApiResponse<JaminBookingResponseDto>.FailureResult("No pending payment found to verify."));

            // Verify payment
            payment.Status = "Verified";
            payment.VerifiedAt = DateTime.UtcNow;
            payment.VerifiedByUserId = currentUserId;
            payment.VerifiedByName = currentUserName;
            if (!string.IsNullOrWhiteSpace(dto.ReceiptNumber)) payment.ReceiptNumber = dto.ReceiptNumber.Trim();
            if (!string.IsNullOrWhiteSpace(dto.Notes)) payment.Notes = dto.Notes.Trim();
            payment.UpdatedAt = DateTime.UtcNow;

            // Update booking status
            booking.PaymentStatus = "Verified";
            if (booking.Status is "Hold" or "Pending Verification" or "Token Paid")
            {
                booking.Status = "Token Verified";
            }
            booking.UpdatedAt = DateTime.UtcNow;

            // ── LEAD-TO-CUSTOMER CONVERSION TRIGGER ──
            // Only now does the buyer become a Customer in Customer 360!
            Customer? customer = null;
            if (booking.CustomerId.HasValue)
            {
                customer = await _db.Customers.FirstOrDefaultAsync(c => c.Id == booking.CustomerId.Value && c.CompanyId == companyId, ct);
            }
            if (customer == null && !string.IsNullOrWhiteSpace(booking.CustomerPhone))
            {
                customer = await _db.Customers.FirstOrDefaultAsync(c => c.Phone == booking.CustomerPhone.Trim() && c.CompanyId == companyId, ct);
            }

            Lead? matchedLead = null;
            if (booking.LeadId.HasValue && booking.LeadId.Value > 0)
            {
                matchedLead = await _db.Leads.FirstOrDefaultAsync(l => l.Id == booking.LeadId.Value, ct);
            }
            if (matchedLead == null && !string.IsNullOrWhiteSpace(booking.CustomerPhone))
            {
                matchedLead = await _db.Leads.FirstOrDefaultAsync(l => l.Phone == booking.CustomerPhone.Trim(), ct);
            }

            if (customer == null)
            {
                customer = new Customer
                {
                    CompanyId = companyId,
                    Name = booking.CustomerName.Trim(),
                    Phone = booking.CustomerPhone.Trim(),
                    Email = matchedLead?.Email ?? string.Empty,
                    Location = matchedLead?.Location ?? string.Empty,
                    Status = "Active",
                    TotalValue = booking.TotalPlotPrice,
                    Notes = $"Customer profile confirmed via verified booking for {booking.PlotNumber} ({booking.ProjectName}).",
                    AssignedAgentId = booking.AssignedAgentId,
                    CreatedAt = DateTime.UtcNow
                };
                _db.Customers.Add(customer);
                await _db.SaveChangesAsync(ct);
            }
            else
            {
                customer.Status = "Active";
                customer.AssignedAgentId ??= booking.AssignedAgentId;
                customer.UpdatedAt = DateTime.UtcNow;
            }

            // Link customer to booking and payment
            booking.CustomerId = customer.Id;
            payment.CustomerId = customer.Id;

            // Recalculate customer TotalValue across all active bookings (supporting repeat bookings)
            await RecalculateCustomerTotalValueAsync(customer.Id, companyId, ct);

            // Link plot
            if (booking.PlotId.HasValue)
            {
                var plot = await _db.JaminPlots.FirstOrDefaultAsync(p => p.Id == booking.PlotId.Value && p.CompanyId == companyId, ct);
                if (plot != null)
                {
                    plot.Status = "Booked";
                    plot.HeldByCustomerId = customer.Id;
                    plot.UpdatedAt = DateTime.UtcNow;
                }
            }

            // Mark matched Lead as Converted & transfer all history to Customer 360
            if (matchedLead != null)
            {
                matchedLead.Status = "Converted";
                matchedLead.UpdatedAt = DateTime.UtcNow;
                await LinkLeadHistoryToCustomerAsync(matchedLead, customer, companyId, ct);
            }

            // Create Audit Log
            _db.AuditLogs.Add(new AuditLog
            {
                CompanyId = companyId,
                Timestamp = DateTime.UtcNow,
                ActorName = currentUserName,
                ActorEmail = User.GetUserEmail() ?? string.Empty,
                Action = "PAYMENT_VERIFIED",
                EntityType = "JaminBooking",
                EntityId = booking.Id.ToString(),
                LeadId = booking.LeadId,
                CustomerId = customer.Id,
                Details = $"Verified {payment.PaymentType} payment of ₹{payment.Amount:N2} for Plot {booking.PlotNumber}. Customer {customer.Name} linked/converted.",
                Module = "Bookings",
                Status = "Success"
            });

            await _db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);

            return Ok(ApiResponse<JaminBookingResponseDto>.SuccessResult(ToDto(booking), 
                $"Payment verified. Customer {customer.Name} confirmed and linked."));
        });
    }

    /// <summary>
    /// Record an installment, milestone payment, or registration fee in the ledger.
    /// </summary>
    [HttpPost("{id:int}/payments")]
    public async Task<IActionResult> AddPayment(int id, [FromBody] AddBookingPaymentRequestDto dto, CancellationToken ct)
    {
        var companyId = JaminCompanyId;
        if (dto.Amount <= 0)
            return BadRequest(ApiResponse<JaminBookingResponseDto>.FailureResult("Payment amount must be greater than zero."));

        var booking = await _db.JaminBookings
            .Include(b => b.Payments)
            .FirstOrDefaultAsync(b => b.Id == id && b.CompanyId == companyId, ct);

        if (booking == null) return NotFound(ApiResponse<JaminBookingResponseDto>.FailureResult("Booking not found."));
        if (booking.Status is "Cancelled" or "Voided")
            return Conflict(ApiResponse<JaminBookingResponseDto>.FailureResult("Cannot record payment for a cancelled booking."));

        var isFinanceUser = User.IsInRole("company_admin") || User.IsInRole("super_admin") || User.IsInRole("sales_manager");
        var paymentStatus = isFinanceUser ? "Verified" : "Pending";

        var payment = new JaminPayment
        {
            CompanyId = companyId,
            BookingId = booking.Id,
            CustomerId = booking.CustomerId,
            LeadId = booking.LeadId,
            Amount = dto.Amount,
            PaymentType = dto.PaymentType?.Trim() ?? "Installment",
            PaymentMode = dto.PaymentMode?.Trim() ?? "Bank Transfer / NEFT",
            TransactionReference = dto.TransactionReference?.Trim() ?? string.Empty,
            ReceiptNumber = dto.ReceiptNumber?.Trim(),
            Status = paymentStatus,
            VerifiedAt = isFinanceUser ? DateTime.UtcNow : null,
            VerifiedByUserId = isFinanceUser ? User.GetUserId() : null,
            VerifiedByName = isFinanceUser ? (User.GetUserName() ?? "Finance Officer") : null,
            Notes = dto.Notes?.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        _db.JaminPayments.Add(payment);
        booking.Payments.Add(payment);
        booking.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        return Ok(ApiResponse<JaminBookingResponseDto>.SuccessResult(ToDto(booking), 
            isFinanceUser ? "Payment recorded and verified." : "Payment submitted. Awaiting finance verification."));
    }

    /// <summary>
    /// Advance booking lifecycle stage (Agreement Signed, Registration Completed).
    /// </summary>
    [HttpPut("{id:int}/status")]
    public async Task<IActionResult> UpdateBookingStatus(int id, [FromBody] UpdateJaminBookingStatusDto dto, CancellationToken ct)
    {
        var normalizedStatus = BookingStatuses.FirstOrDefault(s => string.Equals(s, dto.Status?.Trim(), StringComparison.OrdinalIgnoreCase));
        if (normalizedStatus == null) 
            return BadRequest(ApiResponse<JaminBookingResponseDto>.FailureResult("Status must be Token Verified, Agreement Signed, Registration Completed, or Cancelled."));

        var booking = await _db.JaminBookings
            .Include(b => b.Payments)
            .FirstOrDefaultAsync(b => b.Id == id && b.CompanyId == JaminCompanyId, ct);

        if (booking == null) return NotFound(ApiResponse<JaminBookingResponseDto>.FailureResult("Booking not found."));
        if (booking.Status == "Registration Completed" && normalizedStatus != "Registration Completed" && normalizedStatus != "Voided")
            return Conflict(ApiResponse<JaminBookingResponseDto>.FailureResult("A completed registration cannot move backwards."));
        if (booking.Status is "Cancelled" or "Voided" && normalizedStatus != booking.Status)
            return Conflict(ApiResponse<JaminBookingResponseDto>.FailureResult("A cancelled or voided booking cannot be reopened."));

        booking.Status = normalizedStatus;
        if (dto.TokenAmountPaid.HasValue && dto.TokenAmountPaid.Value >= 0) booking.TokenAmountPaid = dto.TokenAmountPaid.Value;
        if (dto.PaymentMode != null) booking.PaymentMode = dto.PaymentMode.Trim();
        if (dto.PaymentTerms != null) booking.PaymentTerms = dto.PaymentTerms.Trim();
        if (!string.IsNullOrWhiteSpace(dto.Notes)) booking.Notes = string.IsNullOrWhiteSpace(booking.Notes) ? dto.Notes.Trim() : $"{booking.Notes}\n{dto.Notes.Trim()}";
        booking.UpdatedAt = DateTime.UtcNow;

        var plot = booking.PlotId.HasValue ? await _db.JaminPlots.FirstOrDefaultAsync(p => p.Id == booking.PlotId && p.CompanyId == booking.CompanyId, ct) : null;
        if (plot != null)
        {
            if (normalizedStatus == "Registration Completed") plot.Status = "Registered";
            else if (normalizedStatus == "Cancelled")
            {
                plot.Status = "Available";
                plot.HeldByCustomerId = null;
                plot.HeldByCustomerName = null;
                plot.HeldByCustomerPhone = null;
                plot.HoldByAgent = null;
                plot.HoldExpiresAt = null;
                booking.CancelledAt = DateTime.UtcNow;
            }
            plot.UpdatedAt = DateTime.UtcNow;

            var project = await _db.JaminProjects.FirstOrDefaultAsync(p => p.Id == plot.ProjectId && p.CompanyId == booking.CompanyId, ct);
            if (project != null) await RecalculateInventoryAsync(project, ct);
        }

        if (normalizedStatus == "Cancelled" && booking.CustomerId.HasValue)
        {
            await RecalculateCustomerTotalValueAsync(booking.CustomerId.Value, booking.CompanyId, ct);
        }

        await _db.SaveChangesAsync(ct);
        return Ok(ApiResponse<JaminBookingResponseDto>.SuccessResult(ToDto(booking), "Booking status updated."));
    }

    /// <summary>
    /// Cancel a booking with cancellation reason, refund tracking, and inventory release.
    /// Preserves booking record and customer profile. Restricts refunds and confirmed cancellations to authorized roles.
    /// </summary>
    [HttpPost("{id:int}/cancel")]
    public async Task<IActionResult> CancelBookingWithAudit(int id, [FromBody] CancelBookingRequestDto dto, CancellationToken ct)
    {
        var companyId = JaminCompanyId;
        var currentUserId = User.GetUserId();
        var currentUserName = User.GetUserName();
        if (string.IsNullOrWhiteSpace(currentUserName)) currentUserName = "Agent";

        var isManager = User.IsInRole("company_admin") || User.IsInRole("super_admin") || User.IsInRole("sales_manager") || User.IsInRole("admin");
        var isSalesExecutive = User.IsInRole("sales_executive");

        // Role Check 1: Refunds strictly require manager/admin authorization
        if (dto.RefundAmount > 0 && !isManager)
        {
            return StatusCode(StatusCodes.Status403Forbidden, 
                ApiResponse<bool>.FailureResult("Processing or verifying cash refunds requires sales manager or company administrator authorization."));
        }

        var strategy = _db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync<IActionResult>(async () =>
        {
            _db.ChangeTracker.Clear();
            await using var transaction = await _db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct);

            var booking = await _db.JaminBookings
                .Include(b => b.Payments)
                .FirstOrDefaultAsync(b => b.Id == id && b.CompanyId == companyId, ct);

            if (booking == null) return NotFound(ApiResponse<bool>.FailureResult("Booking not found."));
            if (booking.Status == "Cancelled") return Ok(ApiResponse<bool>.SuccessResult(true, "Booking is already cancelled."));
            if (booking.Status == "Registration Completed")
                return Conflict(ApiResponse<bool>.FailureResult("A registered plot conveyance deed cannot be cancelled via standard booking cancellation."));

            // Role Check 2: Cancelling confirmed bookings or bookings with verified receipts requires manager/admin
            var hasVerifiedReceipts = booking.Payments.Any(p => p.Status == "Verified" && p.PaymentType != "Refund");
            if ((booking.Status is "Token Verified" or "Agreement Signed" || hasVerifiedReceipts) && !isManager)
            {
                return StatusCode(StatusCodes.Status403Forbidden,
                    ApiResponse<bool>.FailureResult("Only sales managers and company administrators can cancel confirmed plot bookings or bookings with verified token payments."));
            }

            // Role Check 3: Sales executives can only cancel temporary hold reservations assigned to themselves
            if (isSalesExecutive && booking.AssignedAgentId.HasValue && booking.AssignedAgentId.Value != currentUserId)
            {
                return StatusCode(StatusCodes.Status403Forbidden,
                    ApiResponse<bool>.FailureResult("Sales executives can cancel temporary hold reservations only for bookings assigned to themselves."));
            }

            booking.Status = "Cancelled";
            booking.CancelledAt = DateTime.UtcNow;
            booking.CancelledByUserId = currentUserId > 0 ? currentUserId : null;
            booking.CancelledByName = currentUserName;
            booking.CancellationReason = dto.CancellationReason?.Trim() ?? "Customer requested cancellation";
            booking.RefundAmount = dto.RefundAmount > 0 ? dto.RefundAmount : 0;
            if (!string.IsNullOrWhiteSpace(dto.Notes))
                booking.Notes = $"{booking.Notes}\n[Cancellation Note: {dto.Notes.Trim()}]";
            booking.UpdatedAt = DateTime.UtcNow;

            // Record actual refund entry in Payment Ledger if refund issued
            if (dto.RefundAmount > 0)
            {
                var refundEntry = new JaminPayment
                {
                    CompanyId = companyId,
                    BookingId = booking.Id,
                    CustomerId = booking.CustomerId,
                    LeadId = booking.LeadId,
                    Amount = dto.RefundAmount,
                    PaymentType = "Refund",
                    PaymentMode = dto.RefundPaymentMode?.Trim() ?? "Bank Transfer",
                    TransactionReference = dto.RefundTransactionReference?.Trim() ?? string.Empty,
                    Status = "Verified",
                    VerifiedAt = DateTime.UtcNow,
                    VerifiedByUserId = currentUserId > 0 ? currentUserId : null,
                    VerifiedByName = currentUserName,
                    Notes = $"Refund payout for cancelled booking #{booking.Id}",
                    CreatedAt = DateTime.UtcNow
                };
                _db.JaminPayments.Add(refundEntry);
                booking.Payments.Add(refundEntry);
            }

            // Release plot inventory back to Available
            if (booking.PlotId.HasValue)
            {
                var plot = await _db.JaminPlots.FirstOrDefaultAsync(p => p.Id == booking.PlotId.Value && p.CompanyId == companyId, ct);
                if (plot != null)
                {
                    plot.Status = "Available";
                    plot.HeldByCustomerId = null;
                    plot.HeldByCustomerName = null;
                    plot.HeldByCustomerPhone = null;
                    plot.HoldByAgent = null;
                    plot.HoldExpiresAt = null;
                    plot.UpdatedAt = DateTime.UtcNow;

                    var project = await _db.JaminProjects.FirstOrDefaultAsync(p => p.Id == plot.ProjectId && p.CompanyId == companyId, ct);
                    if (project != null) await RecalculateInventoryAsync(project, ct);
                }
            }

            // Recalculate customer TotalValue across all remaining active bookings upon cancellation
            if (booking.CustomerId.HasValue)
            {
                await RecalculateCustomerTotalValueAsync(booking.CustomerId.Value, companyId, ct);
            }

            // Audit log
            _db.AuditLogs.Add(new AuditLog
            {
                CompanyId = companyId,
                Timestamp = DateTime.UtcNow,
                ActorName = currentUserName,
                ActorEmail = User.GetUserEmail() ?? string.Empty,
                Action = "BOOKING_CANCELLED",
                EntityType = "JaminBooking",
                EntityId = booking.Id.ToString(),
                LeadId = booking.LeadId,
                CustomerId = booking.CustomerId,
                Details = $"Cancelled booking for Plot {booking.PlotNumber}. Reason: {booking.CancellationReason}. Refund Amount: ₹{booking.RefundAmount:N2}. Plot released to Available.",
                Module = "Bookings",
                Status = "Success"
            });

            await _db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);

            return Ok(ApiResponse<bool>.SuccessResult(true, "Booking cancelled successfully. Plot released to inventory."));
        });
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "company_admin,super_admin,sales_manager")]
    public async Task<IActionResult> DeleteOrCancelBooking(int id, CancellationToken ct)
    {
        return await CancelBookingWithAudit(id, new CancelBookingRequestDto { CancellationReason = "Deleted by management" }, ct);
    }

    // ── Helper Mappers & Calculators ─────────────────────────────────────────

    private static JaminBookingResponseDto ToDto(JaminBooking b)
    {
        var payments = b.Payments != null 
            ? b.Payments.Select(p => new JaminPaymentResponseDto
            {
                Id = p.Id,
                CompanyId = p.CompanyId,
                BookingId = p.BookingId,
                CustomerId = p.CustomerId,
                LeadId = p.LeadId,
                Amount = p.Amount,
                PaymentType = p.PaymentType,
                PaymentMode = p.PaymentMode,
                TransactionReference = p.TransactionReference,
                Status = p.Status,
                VerifiedAt = p.VerifiedAt,
                VerifiedByUserId = p.VerifiedByUserId,
                VerifiedByName = p.VerifiedByName,
                ReceiptNumber = p.ReceiptNumber,
                Notes = p.Notes,
                CreatedAt = p.CreatedAt
            }).ToList()
            : new List<JaminPaymentResponseDto>();

        // Financial calculations derived strictly from transaction records
        var verifiedReceipts = payments
            .Where(p => p.Status == "Verified" && p.PaymentType != "Refund")
            .Sum(p => p.Amount);

        // Backward compatibility fallback for legacy bookings where payment records weren't saved yet
        if (verifiedReceipts == 0 && (b.Status == "Token Paid" || b.PaymentStatus == "Verified") && b.TokenAmountPaid > 0)
        {
            verifiedReceipts = b.TokenAmountPaid;
        }

        var totalRefunds = payments
            .Where(p => p.Status == "Verified" && p.PaymentType == "Refund")
            .Sum(p => p.Amount) + b.RefundAmount;

        var netCashReceived = Math.Max(0, verifiedReceipts - totalRefunds);
        var contractValue = b.TotalPlotPrice;
        var contractBalance = (b.Status is "Cancelled" or "Voided") 
            ? 0 
            : Math.Max(0, contractValue - netCashReceived);

        return new JaminBookingResponseDto
        {
            Id = b.Id,
            CompanyId = b.CompanyId,
            CustomerId = b.CustomerId,
            LeadId = b.LeadId,
            ProjectId = b.ProjectId,
            PlotId = b.PlotId,
            CustomerName = b.CustomerName,
            CustomerPhone = b.CustomerPhone,
            ProjectName = b.ProjectName,
            PlotNumber = b.PlotNumber,
            BasePrice = b.BasePrice > 0 ? b.BasePrice : b.TotalPlotPrice,
            DevelopmentCharges = b.DevelopmentCharges,
            ApprovedDiscounts = b.ApprovedDiscounts,
            TotalPlotPrice = b.TotalPlotPrice,
            TokenAmountPaid = b.TokenAmountPaid,
            PaymentMode = b.PaymentMode,
            PaymentTerms = b.PaymentTerms,
            Status = b.Status,
            PaymentStatus = b.PaymentStatus,
            HoldExpiresAt = b.HoldExpiresAt,
            BookingDate = b.BookingDate,
            AssignedAgentId = b.AssignedAgentId,
            AssignedAgentName = b.AssignedAgentName,
            CancelledAt = b.CancelledAt,
            CancelledByUserId = b.CancelledByUserId,
            CancelledByName = b.CancelledByName,
            CancellationReason = b.CancellationReason,
            RefundAmount = b.RefundAmount,
            Notes = b.Notes,
            CreatedAt = b.CreatedAt,
            UpdatedAt = b.UpdatedAt,
            Payments = payments,
            VerifiedReceipts = verifiedReceipts,
            TotalRefunds = totalRefunds,
            NetCashReceived = netCashReceived,
            ContractBalance = contractBalance
        };
    }

    private async Task RecalculateInventoryAsync(JaminProject project, CancellationToken ct)
    {
        var plots = await _db.JaminPlots.Where(p => p.ProjectId == project.Id && p.CompanyId == project.CompanyId).ToListAsync(ct);
        project.BookedPlots = plots.Count(p => p.Status is "Booked" or "Registered" or "Sold");
        project.AvailablePlots = plots.Count(p => p.Status == "Available");
        project.UpdatedAt = DateTime.UtcNow;
    }

    private async Task LinkLeadHistoryToCustomerAsync(Lead lead, Customer customer, int companyId, CancellationToken ct)
    {
        var calls = await _db.CallRecords.Where(x => x.LeadId == lead.Id && x.CompanyId == companyId).ToListAsync(ct);
        foreach (var call in calls) call.CustomerId = customer.Id;

        var followups = await _db.Followups.Where(x => x.LeadId == lead.Id && x.CompanyId == companyId).ToListAsync(ct);
        foreach (var followup in followups)
        {
            followup.CustomerId = customer.Id;
            followup.ContactType = "customer";
            followup.ContactId = customer.Id.ToString();
        }

        var visits = await _db.SiteVisits.Where(x => x.LeadId == lead.Id && x.TenantId == companyId).ToListAsync(ct);
        foreach (var visit in visits)
        {
            visit.CustomerId = customer.Id;
            visit.ContactType = "customer";
        }

        var bookings = await _db.JaminBookings.Where(x => x.LeadId == lead.Id && x.CompanyId == companyId).ToListAsync(ct);
        foreach (var booking in bookings) booking.CustomerId = customer.Id;

        var payments = await _db.JaminPayments.Where(x => x.LeadId == lead.Id && x.CompanyId == companyId).ToListAsync(ct);
        foreach (var payment in payments) payment.CustomerId = customer.Id;

        var notifications = await _db.Notifications.Where(x => x.LeadId == lead.Id && x.CompanyId == companyId).ToListAsync(ct);
        foreach (var notification in notifications) notification.CustomerId = customer.Id;

        var auditLogs = await _db.AuditLogs.Where(x => x.LeadId == lead.Id && x.CompanyId == companyId).ToListAsync(ct);
        foreach (var auditLog in auditLogs) auditLog.CustomerId = customer.Id;
    }

    private async Task RecalculateCustomerTotalValueAsync(int customerId, int companyId, CancellationToken ct)
    {
        var customer = await _db.Customers.FirstOrDefaultAsync(c => c.Id == customerId && c.CompanyId == companyId, ct);
        if (customer == null) return;

        var activeBookings = await _db.JaminBookings
            .Where(b => b.CustomerId == customerId && b.CompanyId == companyId &&
                        b.Status != "Cancelled" && b.Status != "Voided" && b.Status != "Hold Expired")
            .ToListAsync(ct);

        customer.TotalValue = activeBookings.Sum(b => b.TotalPlotPrice);
        customer.UpdatedAt = DateTime.UtcNow;
    }
}
