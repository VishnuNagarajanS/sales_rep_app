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
    private static readonly string[] BookingStatuses = { "Token Paid", "Agreement Signed", "Registration Completed", "Cancelled" };
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

        JaminPlot? plot = null;
        JaminProject? project = null;
        if (dto.PlotId.HasValue)
        {
            plot = await _db.JaminPlots.FirstOrDefaultAsync(p => p.Id == dto.PlotId && p.CompanyId == companyId, ct);
            if (plot == null) return BadRequest(ApiResponse<JaminBookingResponseDto>.FailureResult("Plot not found."));
            if (plot.Status == "Hold" && plot.HoldExpiresAt <= DateTime.UtcNow)
            {
                plot.Status = "Available"; plot.HeldByCustomerName = null; plot.HeldByCustomerPhone = null; plot.HoldExpiresAt = null;
            }
            if (plot.Status != "Available" && !(plot.Status == "Hold" && plot.HeldByCustomerPhone == dto.CustomerPhone))
                return Conflict(ApiResponse<JaminBookingResponseDto>.FailureResult("Plot is not available for this customer."));
            project = await _db.JaminProjects.FirstOrDefaultAsync(p => p.Id == plot.ProjectId && p.CompanyId == companyId, ct);
        }
        else if (dto.ProjectId.HasValue)
        {
            project = await _db.JaminProjects.FirstOrDefaultAsync(p => p.Id == dto.ProjectId && p.CompanyId == companyId, ct);
            if (project == null) return BadRequest(ApiResponse<JaminBookingResponseDto>.FailureResult("Project not found."));
        }

        var agentId = dto.AssignedAgentId ?? User.GetUserId();
        var agent = agentId > 0 ? await _db.Users.FirstOrDefaultAsync(u => u.Id == agentId && u.CompanyId == companyId, ct) : null;
        if (dto.AssignedAgentId.HasValue && agent == null)
            return BadRequest(ApiResponse<JaminBookingResponseDto>.FailureResult("Assigned agent not found in Jamin Bazaar."));
        var totalPrice = dto.TotalPlotPrice > 0 ? dto.TotalPlotPrice : plot?.Price ?? 0;
        if (dto.TokenAmountPaid > totalPrice)
            return BadRequest(ApiResponse<JaminBookingResponseDto>.FailureResult("Token amount cannot exceed the total plot price."));
        var booking = new JaminBooking
        {
            CompanyId = companyId, ProjectId = project?.Id, PlotId = plot?.Id,
            CustomerName = dto.CustomerName.Trim(), CustomerPhone = dto.CustomerPhone.Trim(),
            ProjectName = project?.Name ?? dto.ProjectName?.Trim() ?? string.Empty,
            PlotNumber = plot?.PlotNumber ?? dto.PlotNumber?.Trim() ?? string.Empty,
            TotalPlotPrice = totalPrice,
            TokenAmountPaid = dto.TokenAmountPaid, PaymentMode = dto.PaymentMode?.Trim() ?? "Bank Transfer / NEFT",
            Status = "Token Paid", BookingDate = DateTime.UtcNow,
            AssignedAgentId = agent?.Id,
            AssignedAgentName = agent?.Name ?? string.Empty, Notes = dto.Notes?.Trim(), CreatedAt = DateTime.UtcNow
        };
        if (plot != null)
        {
            plot.Status = "Booked"; plot.HeldByCustomerName = booking.CustomerName;
            plot.HeldByCustomerPhone = booking.CustomerPhone; plot.HoldExpiresAt = null; plot.UpdatedAt = DateTime.UtcNow;
            if (project != null) { project.AvailablePlots = Math.Max(0, project.AvailablePlots - 1); project.BookedPlots++; project.UpdatedAt = DateTime.UtcNow; }
        }
        _db.JaminBookings.Add(booking);
        await _db.SaveChangesAsync(ct);
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
        if (booking.Status == "Registration Completed" && normalizedStatus == "Cancelled")
            return Conflict(ApiResponse<JaminBookingResponseDto>.FailureResult("A completed registration cannot be cancelled."));
        if (booking.Status == "Cancelled" && normalizedStatus != "Cancelled")
            return Conflict(ApiResponse<JaminBookingResponseDto>.FailureResult("A cancelled booking cannot be reopened."));
        var wasCancelled = booking.Status == "Cancelled";
        booking.Status = normalizedStatus;
        if (!string.IsNullOrWhiteSpace(dto.Notes)) booking.Notes = string.IsNullOrWhiteSpace(booking.Notes) ? dto.Notes.Trim() : $"{booking.Notes}\n{dto.Notes.Trim()}";
        booking.UpdatedAt = DateTime.UtcNow;
        var plot = booking.PlotId.HasValue ? await _db.JaminPlots.FirstOrDefaultAsync(p => p.Id == booking.PlotId && p.CompanyId == booking.CompanyId, ct) : null;
        if (plot != null)
        {
            if (normalizedStatus == "Cancelled")
            {
                plot.Status = "Available"; plot.HeldByCustomerName = null; plot.HeldByCustomerPhone = null;
                if (!wasCancelled)
                {
                    var project = await _db.JaminProjects.FirstOrDefaultAsync(p => p.Id == plot.ProjectId && p.CompanyId == booking.CompanyId, ct);
                    if (project != null) { project.AvailablePlots++; project.BookedPlots = Math.Max(0, project.BookedPlots - 1); project.UpdatedAt = DateTime.UtcNow; }
                }
            }
            else plot.Status = normalizedStatus == "Registration Completed" ? "Registered" : "Booked";
            plot.HoldExpiresAt = null; plot.UpdatedAt = DateTime.UtcNow;
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
                plot.Status = "Available"; plot.HeldByCustomerName = null; plot.HeldByCustomerPhone = null; plot.HoldExpiresAt = null; plot.UpdatedAt = DateTime.UtcNow;
                var project = await _db.JaminProjects.FirstOrDefaultAsync(p => p.Id == plot.ProjectId && p.CompanyId == booking.CompanyId, ct);
                if (project != null) { project.AvailablePlots++; project.BookedPlots = Math.Max(0, project.BookedPlots - 1); project.UpdatedAt = DateTime.UtcNow; }
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
        AssignedAgentId = b.AssignedAgentId, AssignedAgentName = b.AssignedAgentName,
        Notes = b.Notes, CreatedAt = b.CreatedAt, UpdatedAt = b.UpdatedAt
    };
}
