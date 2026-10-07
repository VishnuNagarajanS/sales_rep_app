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
    private static readonly string[] BookingStatuses = { "Token Paid", "Agreement Signed", "Registration Completed", "Cancelled", "Voided" };
    private readonly ApplicationDbContext _db;
    public JaminBookingsController(ApplicationDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetBookings(CancellationToken ct)
    {
        try
        {
            var bookings = (await _db.JaminBookings.AsNoTracking().Where(b => b.CompanyId == JaminCompanyId)
                .OrderByDescending(b => b.BookingDate).ToListAsync(ct)).Select(ToDto).ToList();
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
        var booking = await _db.JaminBookings.AsNoTracking()
            .FirstOrDefaultAsync(b => b.Id == id && b.CompanyId == JaminCompanyId, ct);
        return booking == null ? NotFound(ApiResponse<JaminBookingResponseDto>.FailureResult("Booking not found."))
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

        await using var transaction = await _db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct);
        JaminPlot? plot = null;
        JaminProject? project = null;
        if (dto.PlotId.HasValue)
        {
            plot = await _db.JaminPlots.FirstOrDefaultAsync(p => p.Id == dto.PlotId && p.CompanyId == companyId, ct);
            if (plot == null) return BadRequest(ApiResponse<JaminBookingResponseDto>.FailureResult("Plot not found."));
            if (plot.Status is "Registered" or "Sold")
                return Conflict(ApiResponse<JaminBookingResponseDto>.FailureResult("This plot has already been registered or sold."));
            var hasActiveBooking = await _db.JaminBookings.AnyAsync(b => b.PlotId == plot.Id && b.CompanyId == companyId && b.Status != "Cancelled", ct);
            if (hasActiveBooking)
                return Conflict(ApiResponse<JaminBookingResponseDto>.FailureResult("This plot already has an active booking."));
            if (plot.Status == "Hold" && plot.HoldExpiresAt <= DateTime.UtcNow)
            {
                plot.Status = "Available"; plot.HeldByCustomerName = null; plot.HeldByCustomerPhone = null; plot.HoldExpiresAt = null;
            }
            if (plot.Status != "Available" && !(plot.Status == "Hold" && plot.HeldByCustomerPhone == dto.CustomerPhone))
                return Conflict(ApiResponse<JaminBookingResponseDto>.FailureResult("Plot is not available for this customer."));
            project = await _db.JaminProjects.FirstOrDefaultAsync(p => p.Id == plot.ProjectId && p.CompanyId == companyId, ct);
        }

        var agentId = dto.AssignedAgentId ?? User.GetUserId();
        var agent = agentId > 0 ? await _db.Users.FirstOrDefaultAsync(u => u.Id == agentId && u.CompanyId == companyId, ct) : null;
        if (dto.AssignedAgentId.HasValue && agent == null)
            return BadRequest(ApiResponse<JaminBookingResponseDto>.FailureResult("Assigned agent not found in Jamin Bazaar."));
        var totalPrice = dto.TotalPlotPrice > 0 ? dto.TotalPlotPrice : plot?.Price ?? 0;
        if (dto.TokenAmountPaid > totalPrice)
            return BadRequest(ApiResponse<JaminBookingResponseDto>.FailureResult("Token amount cannot exceed the total plot price."));

        // 1. Resolve Lead if explicitly provided or by phone
        Lead? matchedLead = null;
        if (dto.LeadId.HasValue && dto.LeadId.Value > 0)
        {
            matchedLead = await _db.Leads.FirstOrDefaultAsync(l => l.Id == dto.LeadId.Value && l.CompanyId == companyId, ct);
        }
        if (matchedLead == null && !string.IsNullOrWhiteSpace(dto.CustomerPhone))
        {
            matchedLead = await _db.Leads.FirstOrDefaultAsync(l => l.Phone == dto.CustomerPhone.Trim() && l.CompanyId == companyId, ct);
        }

        // 2. Resolve Customer if explicitly provided or by phone
        Customer? customer = null;
        if (dto.CustomerId.HasValue && dto.CustomerId.Value > 0)
        {
            customer = await _db.Customers.FirstOrDefaultAsync(c => c.Id == dto.CustomerId.Value && c.CompanyId == companyId, ct);
        }
        if (customer == null && !string.IsNullOrWhiteSpace(dto.CustomerPhone))
        {
            customer = await _db.Customers.FirstOrDefaultAsync(c => c.Phone == dto.CustomerPhone.Trim() && c.CompanyId == companyId, ct);
        }

        // 3. Automatically create/confirm buyer as an Active Customer in the CRM database
        if (customer == null)
        {
            customer = new Customer
            {
                CompanyId = companyId,
                Name = dto.CustomerName.Trim(),
                Phone = dto.CustomerPhone.Trim(),
                Email = matchedLead?.Email ?? string.Empty,
                Location = matchedLead?.Location ?? string.Empty,
                Status = "Active",
                TotalValue = totalPrice,
                Notes = $"Confirmed via booking for Plot {plot?.PlotNumber ?? dto.PlotNumber ?? string.Empty} in {project?.Name ?? dto.ProjectName ?? string.Empty}.".Trim(),
                AssignedAgentId = agent?.Id ?? matchedLead?.AssignedAgentId,
                CreatedAt = DateTime.UtcNow
            };
            _db.Customers.Add(customer);
            await _db.SaveChangesAsync(ct);
        }
        else
        {
            customer.TotalValue += totalPrice;
            customer.Status = "Active";
            if (string.IsNullOrWhiteSpace(customer.Name)) customer.Name = dto.CustomerName.Trim();
            customer.UpdatedAt = DateTime.UtcNow;
        }

        // 4. Mark matched Lead as Converted
        if (matchedLead != null)
        {
            matchedLead.Status = "Converted";
            matchedLead.UpdatedAt = DateTime.UtcNow;
        }

        var booking = new JaminBooking
        {
            CompanyId = companyId,
            ProjectId = project?.Id,
            PlotId = plot?.Id,
            CustomerId = customer.Id,
            LeadId = matchedLead?.Id,
            CustomerName = dto.CustomerName.Trim(),
            CustomerPhone = dto.CustomerPhone.Trim(),
            ProjectName = project?.Name ?? dto.ProjectName?.Trim() ?? string.Empty,
            PlotNumber = plot?.PlotNumber ?? dto.PlotNumber?.Trim() ?? string.Empty,
            TotalPlotPrice = totalPrice,
            TokenAmountPaid = dto.TokenAmountPaid,
            PaymentMode = !string.IsNullOrWhiteSpace(dto.PaymentMode) ? dto.PaymentMode.Trim() : string.Empty,
            PaymentTerms = dto.PaymentTerms?.Trim(),
            Status = "Token Paid",
            BookingDate = DateTime.UtcNow,
            AssignedAgentId = agent?.Id,
            AssignedAgentName = agent?.Name ?? string.Empty,
            Notes = dto.Notes?.Trim(),
            CreatedAt = DateTime.UtcNow
        };
        if (plot != null)
        {
            plot.Status = "Booked"; plot.HeldByCustomerId = customer.Id; plot.HeldByCustomerName = booking.CustomerName;
            plot.HeldByCustomerPhone = booking.CustomerPhone; plot.HoldByAgent = booking.AssignedAgentName; plot.HoldExpiresAt = null; plot.UpdatedAt = DateTime.UtcNow;
            if (project != null) await RecalculateInventoryAsync(project, ct);
        }

        _db.JaminBookings.Add(booking);
        await _db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return CreatedAtAction(nameof(GetBooking), new { id = booking.Id },
            ApiResponse<JaminBookingResponseDto>.SuccessResult(ToDto(booking), "Booking created."));
    }

    [HttpPut("{id:int}/status")]
    public async Task<IActionResult> UpdateBookingStatus(int id, [FromBody] UpdateJaminBookingStatusDto dto, CancellationToken ct)
    {
        var normalizedStatus = BookingStatuses.FirstOrDefault(s => string.Equals(s, dto.Status?.Trim(), StringComparison.OrdinalIgnoreCase));
        if (normalizedStatus == null) return BadRequest(ApiResponse<JaminBookingResponseDto>.FailureResult("Status must be Token Paid, Agreement Signed, Registration Completed, or Cancelled."));
        var booking = await _db.JaminBookings.FirstOrDefaultAsync(b => b.Id == id && b.CompanyId == JaminCompanyId, ct);
        if (booking == null) return NotFound(ApiResponse<JaminBookingResponseDto>.FailureResult("Booking not found."));
        if (booking.Status == "Registration Completed" && normalizedStatus != "Registration Completed" && normalizedStatus != "Voided")
            return Conflict(ApiResponse<JaminBookingResponseDto>.FailureResult("A completed registration can only be kept completed or voided by an administrator."));
        if (booking.Status is "Cancelled" or "Voided" && normalizedStatus != booking.Status)
            return Conflict(ApiResponse<JaminBookingResponseDto>.FailureResult("A cancelled or voided booking cannot be reopened."));
        if (normalizedStatus == "Voided" && string.IsNullOrWhiteSpace(dto.Notes))
            return BadRequest(ApiResponse<JaminBookingResponseDto>.FailureResult("A reason is required to void a completed booking."));
        if (booking.Status is "Cancelled" or "Voided" &&
            (dto.TokenAmountPaid.HasValue || dto.PaymentMode != null || dto.PaymentTerms != null))
            return Conflict(ApiResponse<JaminBookingResponseDto>.FailureResult("Cancelled or voided booking details cannot be edited."));
        if (dto.TokenAmountPaid is < 0 || dto.TokenAmountPaid > booking.TotalPlotPrice)
            return BadRequest(ApiResponse<JaminBookingResponseDto>.FailureResult("Token amount must be between zero and the total plot price."));
        if (normalizedStatus is not ("Cancelled" or "Voided") && booking.Status != normalizedStatus && BookingRank(normalizedStatus) < BookingRank(booking.Status))
            return Conflict(ApiResponse<JaminBookingResponseDto>.FailureResult("Booking status cannot move backwards."));
        booking.Status = normalizedStatus;
        if (dto.TokenAmountPaid.HasValue) booking.TokenAmountPaid = dto.TokenAmountPaid.Value;
        if (dto.PaymentMode != null) booking.PaymentMode = dto.PaymentMode.Trim();
        if (dto.PaymentTerms != null) booking.PaymentTerms = dto.PaymentTerms.Trim();
        if (!string.IsNullOrWhiteSpace(dto.Notes)) booking.Notes = string.IsNullOrWhiteSpace(booking.Notes) ? dto.Notes.Trim() : $"{booking.Notes}\n{dto.Notes.Trim()}";
        booking.UpdatedAt = DateTime.UtcNow;
        var plot = booking.PlotId.HasValue ? await _db.JaminPlots.FirstOrDefaultAsync(p => p.Id == booking.PlotId && p.CompanyId == booking.CompanyId, ct) : null;
        if (plot != null)
        {
            if (normalizedStatus == "Cancelled")
            {
                plot.Status = "Available"; plot.HeldByCustomerId = null; plot.HeldByCustomerName = null; plot.HeldByCustomerPhone = null; plot.HoldByAgent = null;
            }
            else plot.Status = normalizedStatus == "Registration Completed" ? "Registered" : "Booked";
            plot.HoldExpiresAt = null; plot.UpdatedAt = DateTime.UtcNow;
            var project = await _db.JaminProjects.FirstOrDefaultAsync(p => p.Id == plot.ProjectId && p.CompanyId == booking.CompanyId, ct);
            if (project != null) await RecalculateInventoryAsync(project, ct);
        }
        await _db.SaveChangesAsync(ct);
        return Ok(ApiResponse<JaminBookingResponseDto>.SuccessResult(ToDto(booking), "Booking status updated."));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> CancelBooking(int id, CancellationToken ct)
    {
        var booking = await _db.JaminBookings.FirstOrDefaultAsync(b => b.Id == id && b.CompanyId == JaminCompanyId, ct);
        if (booking == null) return NotFound(ApiResponse<bool>.FailureResult("Booking not found."));
        if (booking.Status == "Cancelled") return Ok(ApiResponse<bool>.SuccessResult(true, "Booking is already cancelled."));
        if (booking.Status == "Registration Completed") return Conflict(ApiResponse<bool>.FailureResult("A completed registration cannot be cancelled."));
        booking.Status = "Cancelled"; booking.UpdatedAt = DateTime.UtcNow;
        if (booking.PlotId.HasValue)
        {
            var plot = await _db.JaminPlots.FirstOrDefaultAsync(p => p.Id == booking.PlotId && p.CompanyId == booking.CompanyId, ct);
            if (plot != null)
            {
                plot.Status = "Available"; plot.HeldByCustomerId = null; plot.HeldByCustomerName = null; plot.HeldByCustomerPhone = null; plot.HoldByAgent = null; plot.HoldExpiresAt = null; plot.UpdatedAt = DateTime.UtcNow;
                var project = await _db.JaminProjects.FirstOrDefaultAsync(p => p.Id == plot.ProjectId && p.CompanyId == booking.CompanyId, ct);
                if (project != null) await RecalculateInventoryAsync(project, ct);
            }
        }
        await _db.SaveChangesAsync(ct);
        return Ok(ApiResponse<bool>.SuccessResult(true, "Booking cancelled."));
    }

    private static JaminBookingResponseDto ToDto(JaminBooking b) => new()
    {
        Id = b.Id, CompanyId = b.CompanyId, ProjectId = b.ProjectId, PlotId = b.PlotId,
        CustomerName = b.CustomerName, CustomerPhone = b.CustomerPhone, ProjectName = b.ProjectName,
        PlotNumber = b.PlotNumber, TotalPlotPrice = b.TotalPlotPrice, TokenAmountPaid = b.TokenAmountPaid,
        PaymentMode = b.PaymentMode, Status = b.Status, BookingDate = b.BookingDate,
        PaymentTerms = b.PaymentTerms,
        AssignedAgentId = b.AssignedAgentId, AssignedAgentName = b.AssignedAgentName,
        Notes = b.Notes, CreatedAt = b.CreatedAt, UpdatedAt = b.UpdatedAt
    };

    private async Task RecalculateInventoryAsync(JaminProject project, CancellationToken ct)
    {
        var plots = await _db.JaminPlots.Where(p => p.ProjectId == project.Id && p.CompanyId == project.CompanyId).ToListAsync(ct);
        project.BookedPlots = plots.Count(p => p.Status is "Booked" or "Registered" or "Sold");
        project.AvailablePlots = plots.Count(p => p.Status == "Available");
        project.UpdatedAt = DateTime.UtcNow;
    }

    private static int BookingRank(string status) => status switch
    {
        "Token Paid" => 1,
        "Agreement Signed" => 2,
        "Registration Completed" => 3,
        _ => 0
    };
}
