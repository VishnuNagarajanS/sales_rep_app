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

    public async Task<ApiResponse<List<JaminBookingResponseDto>>> GetBookingsAsync(int? projectId = null, string? status = null, int? agentId = null, int? leadId = null, int? customerId = null, CancellationToken ct = default)
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

        if (leadId.HasValue && leadId.Value > 0)
        {
            query = query.Where(b => b.LeadId == leadId.Value);
        }

        if (customerId.HasValue && customerId.Value > 0)
        {
            query = query.Where(b => b.CustomerId == customerId.Value);
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
        if (string.IsNullOrWhiteSpace(dto.CustomerName) || string.IsNullOrWhiteSpace(dto.CustomerPhone))
            return ApiResponse<JaminBookingResponseDto>.FailureResult("Buyer name and phone are required.");

        string projectName = dto.ProjectName ?? string.Empty;
        string plotNumber = dto.PlotNumber ?? string.Empty;

        // Resolve Project details
        if (dto.ProjectId.HasValue && dto.ProjectId.Value > 0)
        {
            var project = await _context.JaminProjects
                .FirstOrDefaultAsync(p => p.Id == dto.ProjectId.Value && p.CompanyId == JaminTenantId, ct);
            if (project == null) return ApiResponse<JaminBookingResponseDto>.FailureResult("Selected project was not found.");
            if (string.IsNullOrEmpty(projectName)) projectName = project.Name;
        }
        else return ApiResponse<JaminBookingResponseDto>.FailureResult("Select a project for this booking.");

        // Resolve Plot details and update Plot status
        if (dto.PlotId.HasValue && dto.PlotId.Value > 0)
        {
            var plot = await _context.JaminPlots
                .FirstOrDefaultAsync(p => p.Id == dto.PlotId.Value && p.CompanyId == JaminTenantId, ct);
            if (plot == null) return ApiResponse<JaminBookingResponseDto>.FailureResult("Selected plot was not found.");
            if (plot.ProjectId != dto.ProjectId) return ApiResponse<JaminBookingResponseDto>.FailureResult("Selected plot does not belong to the selected project.");
            if (plot.Status is not ("Available" or "Hold")) return ApiResponse<JaminBookingResponseDto>.FailureResult("Selected plot is not available for booking.");
            if (string.IsNullOrEmpty(plotNumber)) plotNumber = plot.PlotNumber;
            plot.Status = "Booked";
            plot.UpdatedAt = DateTime.UtcNow;
        }
        else return ApiResponse<JaminBookingResponseDto>.FailureResult("Select a plot for this booking.");

        // Resolve Lead ID if passed or matched
        int? leadId = dto.LeadId;
        Lead? matchedLead = null;
        if (leadId.HasValue && leadId.Value > 0)
        {
            matchedLead = await _context.Leads
                .FirstOrDefaultAsync(l => l.Id == leadId.Value && l.CompanyId == JaminTenantId, ct);
        }
        if (dto.LeadId.HasValue && matchedLead == null)
            return ApiResponse<JaminBookingResponseDto>.FailureResult("Selected lead was not found in Jamin.");

        // Resolve Customer ID if not explicitly passed
        int? customerId = dto.CustomerId;
        Customer? matchedCustomer = null;
        if (customerId.HasValue && customerId.Value > 0)
        {
            matchedCustomer = await _context.Customers
                .FirstOrDefaultAsync(c => c.Id == customerId.Value && c.CompanyId == JaminTenantId, ct);
        }
        if (dto.CustomerId.HasValue && matchedCustomer == null)
            return ApiResponse<JaminBookingResponseDto>.FailureResult("Selected customer was not found in Jamin.");

        if (dto.AssignedAgentId.HasValue && !await _context.Users.AnyAsync(
                u => u.Id == dto.AssignedAgentId.Value && u.CompanyId == JaminTenantId, ct))
            return ApiResponse<JaminBookingResponseDto>.FailureResult("Selected agent does not belong to Jamin.");

        var resolvedAgentId = dto.AssignedAgentId ?? matchedCustomer?.AssignedAgentId ?? matchedLead?.AssignedAgentId;
        if (resolvedAgentId.HasValue && !await _context.Users.AnyAsync(
                u => u.Id == resolvedAgentId.Value && u.CompanyId == JaminTenantId, ct))
            return ApiResponse<JaminBookingResponseDto>.FailureResult("The booking agent does not belong to Jamin.");

        // Automatically create or update buyer as an Active Customer in the CRM
        if (matchedCustomer == null)
        {
            var newCustomer = new Customer
            {
                CompanyId = JaminTenantId,
                AssignedAgentId = resolvedAgentId,
                Name = dto.CustomerName.Trim(),
                Phone = dto.CustomerPhone.Trim(),
                Email = matchedLead?.Email ?? string.Empty,
                Location = matchedLead?.Location ?? string.Empty,
                Status = "Active",
                TotalValue = dto.TotalPlotPrice,
                Notes = $"Confirmed via booking for Plot {plotNumber} in {projectName}. {dto.Notes}".Trim(),
                LastContactedAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow
            };
            _context.Customers.Add(newCustomer);
            await _context.SaveChangesAsync(ct);
            customerId = newCustomer.Id;
        }
        else
        {
            matchedCustomer.TotalValue += dto.TotalPlotPrice;
            matchedCustomer.Status = "Active";
            matchedCustomer.AssignedAgentId ??= resolvedAgentId;
            if (string.IsNullOrWhiteSpace(matchedCustomer.Name)) matchedCustomer.Name = dto.CustomerName.Trim();
            matchedCustomer.UpdatedAt = DateTime.UtcNow;
            customerId = matchedCustomer.Id;
        }

        // Mark the linked Lead as Converted in DB
        if (matchedLead != null)
        {
            matchedLead.Status = "Converted";
            matchedLead.UpdatedAt = DateTime.UtcNow;
            await LinkLeadHistoryToCustomerAsync(matchedLead, customerId!.Value, ct);
        }

        // Resolve Agent name
        string agentName = string.Empty;
        if (resolvedAgentId.HasValue)
        {
            var agent = await _context.Users.FirstOrDefaultAsync(u => u.Id == resolvedAgentId.Value && u.CompanyId == JaminTenantId, ct);
            if (agent != null) agentName = agent.Name;
        }

        var booking = new JaminBooking
        {
            CompanyId = JaminTenantId,
            CustomerId = customerId,
            LeadId = leadId,
            ProjectId = dto.ProjectId,
            PlotId = dto.PlotId,
            CustomerName = dto.CustomerName.Trim(),
            CustomerPhone = dto.CustomerPhone.Trim(),
            ProjectName = projectName,
            PlotNumber = plotNumber,
            TotalPlotPrice = dto.TotalPlotPrice,
            TokenAmountPaid = dto.TokenAmountPaid,
            PaymentMode = !string.IsNullOrWhiteSpace(dto.PaymentMode) ? dto.PaymentMode.Trim() : string.Empty,
            PaymentTerms = dto.PaymentTerms?.Trim(),
            Status = "Token Paid",
            BookingDate = DateTime.UtcNow,
            AssignedAgentId = resolvedAgentId,
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
        if (!string.IsNullOrEmpty(dto.PaymentTerms))
        {
            booking.PaymentTerms = dto.PaymentTerms.Trim();
        }
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
                plot.HoldByAgent = null;
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
        CustomerId = b.CustomerId,
        LeadId = b.LeadId,
        ProjectId = b.ProjectId,
        PlotId = b.PlotId,
        CustomerName = b.CustomerName,
        CustomerPhone = b.CustomerPhone,
        ProjectName = b.ProjectName,
        PlotNumber = b.PlotNumber,
        TotalPlotPrice = b.TotalPlotPrice,
        TokenAmountPaid = b.TokenAmountPaid,
        PaymentMode = b.PaymentMode,
        PaymentTerms = b.PaymentTerms,
        Status = b.Status,
        BookingDate = b.BookingDate,
        AssignedAgentId = b.AssignedAgentId,
        AssignedAgentName = b.AssignedAgentName,
        Notes = b.Notes,
        CreatedAt = b.CreatedAt,
        UpdatedAt = b.UpdatedAt
    };

    private async Task LinkLeadHistoryToCustomerAsync(Lead lead, int customerId, CancellationToken ct)
    {
        var calls = await _context.CallRecords.Where(x => x.LeadId == lead.Id && x.CompanyId == JaminTenantId).ToListAsync(ct);
        foreach (var call in calls) call.CustomerId = customerId;

        var followups = await _context.Followups.Where(x => x.LeadId == lead.Id && x.CompanyId == JaminTenantId).ToListAsync(ct);
        foreach (var followup in followups)
        {
            followup.CustomerId = customerId;
            followup.ContactType = "customer";
            followup.ContactId = customerId.ToString();
        }

        var visits = await _context.SiteVisits.Where(x => x.LeadId == lead.Id && x.TenantId == JaminTenantId).ToListAsync(ct);
        foreach (var visit in visits)
        {
            visit.CustomerId = customerId;
            visit.ContactType = "customer";
        }

        var bookings = await _context.JaminBookings.Where(x => x.LeadId == lead.Id && x.CompanyId == JaminTenantId).ToListAsync(ct);
        foreach (var booking in bookings) booking.CustomerId = customerId;

        var notifications = await _context.Notifications.Where(x => x.LeadId == lead.Id && x.CompanyId == JaminTenantId).ToListAsync(ct);
        foreach (var notification in notifications) notification.CustomerId = customerId;

        var auditLogs = await _context.AuditLogs.Where(x => x.LeadId == lead.Id && x.CompanyId == JaminTenantId).ToListAsync(ct);
        foreach (var auditLog in auditLogs) auditLog.CustomerId = customerId;
    }
}
