using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.Jamin;
using backend.Models.Entities;
using backend.Services.Interfaces.Jamin;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Implementations.Jamin;

public class JaminBookingService : IJaminBookingService
{
    private readonly ApplicationDbContext _context;
    private const int JaminTenantId = 2;

    public JaminBookingService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<ApiResponse<List<JaminBookingResponseDto>>> GetBookingsAsync(int? projectId = null, string? status = null, int? agentId = null, CancellationToken ct = default)
    {
        var query = _context.JaminBookings.Where(b => b.CompanyId == JaminTenantId);

        if (projectId.HasValue && projectId.Value > 0)
        {
            query = query.Where(b => b.ProjectId == projectId.Value);
        }

        if (!string.IsNullOrEmpty(status) && status != "All")
        {
            query = query.Where(b => b.Status == status);
        }

        if (agentId.HasValue && agentId.Value > 0)
        {
            query = query.Where(b => b.AssignedAgentId == agentId.Value);
        }

        var bookings = await query.OrderByDescending(b => b.CreatedAt).ToListAsync(ct);
        return ApiResponse<List<JaminBookingResponseDto>>.SuccessResult(bookings.Select(MapToDto).ToList());
    }

    public async Task<ApiResponse<JaminBookingResponseDto>> GetBookingByIdAsync(int id, CancellationToken ct = default)
    {
        var booking = await _context.JaminBookings
            .FirstOrDefaultAsync(b => b.Id == id && b.CompanyId == JaminTenantId, ct);

        if (booking == null)
        {
            return ApiResponse<JaminBookingResponseDto>.FailureResult("Booking not found.");
        }

        return ApiResponse<JaminBookingResponseDto>.SuccessResult(MapToDto(booking));
    }

    public async Task<ApiResponse<JaminBookingResponseDto>> CreateBookingAsync(CreateJaminBookingDto dto, CancellationToken ct = default)
    {
        string projectName = dto.ProjectName ?? string.Empty;
        string plotNumber = dto.PlotNumber ?? string.Empty;

        // Resolve Project details
        if (dto.ProjectId.HasValue && dto.ProjectId.Value > 0)
        {
            var project = await _context.JaminProjects
                .FirstOrDefaultAsync(p => p.Id == dto.ProjectId.Value && p.CompanyId == JaminTenantId, ct);
            if (project != null && string.IsNullOrEmpty(projectName))
            {
                projectName = project.Name;
            }
        }

        // Resolve Plot details and update Plot status
        if (dto.PlotId.HasValue && dto.PlotId.Value > 0)
        {
            var plot = await _context.JaminPlots
                .FirstOrDefaultAsync(p => p.Id == dto.PlotId.Value && p.CompanyId == JaminTenantId, ct);
            if (plot != null)
            {
                if (string.IsNullOrEmpty(plotNumber)) plotNumber = plot.PlotNumber;
                plot.Status = "Booked";
                plot.UpdatedAt = DateTime.UtcNow;
            }
        }

        // Resolve Agent name
        string agentName = "Pooja Hegde";
        if (dto.AssignedAgentId.HasValue && dto.AssignedAgentId.Value > 0)
        {
            var agent = await _context.Users.FirstOrDefaultAsync(u => u.Id == dto.AssignedAgentId.Value, ct);
            if (agent != null) agentName = agent.Name;
        }

        var booking = new JaminBooking
        {
            CompanyId = JaminTenantId,
            ProjectId = dto.ProjectId,
            PlotId = dto.PlotId,
            CustomerName = dto.CustomerName.Trim(),
            CustomerPhone = dto.CustomerPhone.Trim(),
            ProjectName = projectName,
            PlotNumber = plotNumber,
            TotalPlotPrice = dto.TotalPlotPrice,
            TokenAmountPaid = dto.TokenAmountPaid,
            PaymentMode = dto.PaymentMode?.Trim() ?? "Bank Transfer / NEFT",
            Status = "Token Paid",
            BookingDate = DateTime.UtcNow,
            AssignedAgentId = dto.AssignedAgentId ?? 1,
            AssignedAgentName = agentName,
            Notes = dto.Notes?.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        _context.JaminBookings.Add(booking);
        await _context.SaveChangesAsync(ct);

        return ApiResponse<JaminBookingResponseDto>.SuccessResult(MapToDto(booking), "Plot booked successfully with Token Paid.");
    }

    public async Task<ApiResponse<JaminBookingResponseDto>> UpdateBookingStatusAsync(int id, UpdateJaminBookingStatusDto dto, CancellationToken ct = default)
    {
        var booking = await _context.JaminBookings
            .FirstOrDefaultAsync(b => b.Id == id && b.CompanyId == JaminTenantId, ct);

        if (booking == null)
        {
            return ApiResponse<JaminBookingResponseDto>.FailureResult("Booking not found.");
        }

        booking.Status = dto.Status.Trim();
        if (!string.IsNullOrEmpty(dto.Notes))
        {
            booking.Notes = dto.Notes.Trim();
        }
        booking.UpdatedAt = DateTime.UtcNow;

        // If booking is cancelled, release the plot
        if (booking.Status.Equals("Cancelled", StringComparison.OrdinalIgnoreCase) && booking.PlotId.HasValue)
        {
            var plot = await _context.JaminPlots
                .FirstOrDefaultAsync(p => p.Id == booking.PlotId.Value && p.CompanyId == JaminTenantId, ct);
            if (plot != null)
            {
                plot.Status = "Available";
                plot.HeldByCustomerName = null;
                plot.HeldByCustomerPhone = null;
                plot.HoldExpiresAt = null;
                plot.UpdatedAt = DateTime.UtcNow;
            }
        }
        else if (booking.Status.Equals("Registration Completed", StringComparison.OrdinalIgnoreCase) && booking.PlotId.HasValue)
        {
            var plot = await _context.JaminPlots
                .FirstOrDefaultAsync(p => p.Id == booking.PlotId.Value && p.CompanyId == JaminTenantId, ct);
            if (plot != null)
            {
                plot.Status = "Registered";
                plot.UpdatedAt = DateTime.UtcNow;
            }
        }

        await _context.SaveChangesAsync(ct);

        return ApiResponse<JaminBookingResponseDto>.SuccessResult(MapToDto(booking), $"Booking status updated to {booking.Status}.");
    }

    private static JaminBookingResponseDto MapToDto(JaminBooking b) => new()
    {
        Id = b.Id,
        CompanyId = b.CompanyId,
        ProjectId = b.ProjectId,
        PlotId = b.PlotId,
        CustomerName = b.CustomerName,
        CustomerPhone = b.CustomerPhone,
        ProjectName = b.ProjectName,
        PlotNumber = b.PlotNumber,
        TotalPlotPrice = b.TotalPlotPrice,
        TokenAmountPaid = b.TokenAmountPaid,
        PaymentMode = b.PaymentMode,
        Status = b.Status,
        BookingDate = b.BookingDate,
        AssignedAgentId = b.AssignedAgentId,
        AssignedAgentName = b.AssignedAgentName,
        Notes = b.Notes,
        CreatedAt = b.CreatedAt,
        UpdatedAt = b.UpdatedAt
    };
}
