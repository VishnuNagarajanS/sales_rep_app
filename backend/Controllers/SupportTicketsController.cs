using backend.Authentication.Interfaces;
using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.SuperAdmin;
using backend.Models.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Authorize]
[Route("api/support/tickets")]
public class SupportTicketsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public SupportTicketsController(ApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<PlatformTicketDto>>>> GetTenantTickets(
        [FromQuery] string? status = null,
        [FromQuery] string? category = null,
        [FromQuery] string? search = null,
        CancellationToken ct = default)
    {
        var query = _context.PlatformTickets
            .Include(t => t.Timeline)
            .AsNoTracking()
            .AsQueryable();

        // Enforce tenant boundary for non-super-admins
        if (_currentUser.Role != "super_admin")
        {
            var companyId = _currentUser.CompanyId;
            if (!companyId.HasValue || companyId.Value <= 0)
            {
                return Ok(ApiResponse<List<PlatformTicketDto>>.SuccessResult(new List<PlatformTicketDto>(), "No tickets found for account."));
            }
            query = query.Where(t => t.TenantId == companyId.Value);
        }

        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            var s = status.Trim().ToLowerInvariant();
            query = query.Where(t => t.Status.ToLower() == s);
        }

        if (!string.IsNullOrWhiteSpace(category) && !category.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            var c = category.Trim().ToLowerInvariant();
            query = query.Where(t => t.Category.ToLower() == c);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLowerInvariant();
            query = query.Where(t =>
                t.TicketNumber.ToLower().Contains(term) ||
                t.Title.ToLower().Contains(term) ||
                t.Description.ToLower().Contains(term) ||
                t.Category.ToLower().Contains(term) ||
                (t.ReportedByName != null && t.ReportedByName.ToLower().Contains(term))
            );
        }

        var tickets = await query
            .Include(t => t.Timeline)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync(ct);

        var dtos = tickets.Select(MapToDto).ToList();
        return Ok(ApiResponse<List<PlatformTicketDto>>.SuccessResult(dtos, "Support tickets retrieved."));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<PlatformTicketDto>>> GetTenantTicketById(string id, CancellationToken ct = default)
    {
        var ticket = await FindTicketByIdOrNumberAsync(id, ct);
        if (ticket == null)
        {
            return NotFound(ApiResponse<PlatformTicketDto>.FailureResult($"Ticket \"{id}\" not found."));
        }

        // Tenant boundary check
        if (_currentUser.Role != "super_admin" && ticket.TenantId != _currentUser.CompanyId)
        {
            return Forbid();
        }

        return Ok(ApiResponse<PlatformTicketDto>.SuccessResult(MapToDto(ticket)));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<PlatformTicketDto>>> CreateTenantTicket(
        [FromBody] CreatePlatformTicketRequestDto req,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(req.Title))
        {
            return BadRequest(ApiResponse<PlatformTicketDto>.FailureResult("Ticket title is required."));
        }

        if (string.IsNullOrWhiteSpace(req.Description))
        {
            return BadRequest(ApiResponse<PlatformTicketDto>.FailureResult("Ticket description is required."));
        }

        int? companyId = _currentUser.Role == "super_admin" && req.TenantId.HasValue
            ? req.TenantId.Value
            : _currentUser.CompanyId;

        string? tenantName = null;
        string? tenantSlug = null;
        if (companyId.HasValue && companyId.Value > 0)
        {
            var tenant = await _context.Tenants.FindAsync(new object[] { companyId.Value }, ct);
            if (tenant != null)
            {
                tenantName = tenant.Name;
                tenantSlug = tenant.Slug;
            }
        }

        var reporterName = !string.IsNullOrWhiteSpace(_currentUser.Name)
            ? _currentUser.Name.Trim()
            : (!string.IsNullOrWhiteSpace(_currentUser.Email) ? _currentUser.Email.Split('@')[0] : "Staff Member");
        var reporterRole = _currentUser.Role ?? "user";
        var reporterEmail = _currentUser.Email ?? "user@company.com";

        var roleFormatted = reporterRole switch
        {
            "company_admin" => "Company Admin",
            "sales_executive" => "Sales Executive",
            "irm" => "IRM",
            "super_admin" => "Super Admin",
            _ => reporterRole
        };

        var maxId = await _context.PlatformTickets.MaxAsync(t => (int?)t.Id, ct) ?? 0;
        var ticketNumber = $"INC-{DateTime.UtcNow.Year}-{1001 + maxId}";

        var ticket = new PlatformTicket
        {
            TicketNumber = ticketNumber,
            Title = req.Title.Trim(),
            Description = req.Description.Trim(),
            Category = string.IsNullOrWhiteSpace(req.Category) ? "Tenant Operational" : req.Category.Trim(),
            Priority = string.IsNullOrWhiteSpace(req.Priority) ? "medium" : req.Priority.Trim().ToLowerInvariant(),
            Status = "open",
            TenantId = companyId,
            TenantName = tenantName,
            TenantSlug = tenantSlug,
            ReportedByName = $"{reporterName} ({roleFormatted})",
            ReportedByEmail = reporterEmail,
            AssignedToName = "Platform Operations",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Timeline = new List<PlatformTicketEvent>
            {
                new()
                {
                    AuthorName = $"{reporterName} ({roleFormatted})",
                    AuthorEmail = reporterEmail,
                    Message = $"Support ticket {ticketNumber} submitted by {reporterName} ({roleFormatted}) from {tenantName ?? "Company"}.",
                    Type = "system_alert",
                    CreatedAt = DateTime.UtcNow
                }
            }
        };

        _context.PlatformTickets.Add(ticket);
        await _context.SaveChangesAsync(ct);

        _context.AuditLogs.Add(new AuditLog
        {
            Action = "support_ticket_raised",
            EntityType = "PlatformTicket",
            EntityId = ticket.TicketNumber,
            ActorName = reporterName,
            ActorEmail = reporterEmail,
            CompanyId = ticket.TenantId,
            Details = $"{roleFormatted} '{reporterName}' raised support ticket {ticket.TicketNumber}: \"{ticket.Title}\" ({ticket.Priority.ToUpperInvariant()}).",
            Module = "SupportDesk",
            Status = "success",
            Timestamp = DateTime.UtcNow
        });
        await _context.SaveChangesAsync(ct);

        return Ok(ApiResponse<PlatformTicketDto>.SuccessResult(MapToDto(ticket), "Support ticket submitted successfully."));
    }

    [HttpPost("{id}/notes")]
    public async Task<ActionResult<ApiResponse<PlatformTicketDto>>> AddTenantTicketNote(
        string id,
        [FromBody] AddTicketNoteRequestDto req,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(req.Message))
        {
            return BadRequest(ApiResponse<PlatformTicketDto>.FailureResult("Note message cannot be empty."));
        }

        var ticket = await FindTicketByIdOrNumberAsync(id, ct);
        if (ticket == null)
        {
            return NotFound(ApiResponse<PlatformTicketDto>.FailureResult($"Ticket \"{id}\" not found."));
        }

        // Tenant boundary check
        if (_currentUser.Role != "super_admin" && ticket.TenantId != _currentUser.CompanyId)
        {
            return Forbid();
        }

        var reporterName = !string.IsNullOrWhiteSpace(_currentUser.Name)
            ? _currentUser.Name.Trim()
            : (!string.IsNullOrWhiteSpace(_currentUser.Email) ? _currentUser.Email.Split('@')[0] : "Staff Member");
        var reporterRole = _currentUser.Role ?? "user";
        var roleFormatted = reporterRole switch
        {
            "company_admin" => "Company Admin",
            "sales_executive" => "Sales Executive",
            "irm" => "IRM",
            "super_admin" => "Super Admin",
            _ => reporterRole
        };

        ticket.Timeline.Add(new PlatformTicketEvent
        {
            TicketId = ticket.Id,
            AuthorName = $"{reporterName} ({roleFormatted})",
            AuthorEmail = _currentUser.Email ?? "",
            Message = req.Message.Trim(),
            Type = "note",
            CreatedAt = DateTime.UtcNow
        });
        ticket.UpdatedAt = DateTime.UtcNow;

        _context.AuditLogs.Add(new AuditLog
        {
            Action = "support_ticket_note_added",
            EntityType = "PlatformTicket",
            EntityId = ticket.TicketNumber,
            ActorName = reporterName,
            ActorEmail = _currentUser.Email ?? "",
            CompanyId = ticket.TenantId,
            Details = $"Follow-up comment appended to support ticket {ticket.TicketNumber} by {reporterName}.",
            Module = "SupportDesk",
            Status = "success",
            Timestamp = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(ct);

        return Ok(ApiResponse<PlatformTicketDto>.SuccessResult(MapToDto(ticket), "Follow-up update appended."));
    }

    [HttpPost("{id}/reopen")]
    public async Task<ActionResult<ApiResponse<PlatformTicketDto>>> ReopenTenantTicket(
        string id,
        [FromBody] AddTicketNoteRequestDto req,
        CancellationToken ct = default)
    {
        var ticket = await FindTicketByIdOrNumberAsync(id, ct);
        if (ticket == null)
        {
            return NotFound(ApiResponse<PlatformTicketDto>.FailureResult($"Ticket \"{id}\" not found."));
        }

        // Tenant boundary check
        if (_currentUser.Role != "super_admin" && ticket.TenantId != _currentUser.CompanyId)
        {
            return Forbid();
        }

        var reporterName = !string.IsNullOrWhiteSpace(_currentUser.Name)
            ? _currentUser.Name.Trim()
            : (!string.IsNullOrWhiteSpace(_currentUser.Email) ? _currentUser.Email.Split('@')[0] : "Staff Member");
        var reporterRole = _currentUser.Role ?? "user";
        var roleFormatted = reporterRole switch
        {
            "company_admin" => "Company Admin",
            "sales_executive" => "Sales Executive",
            "irm" => "IRM",
            "super_admin" => "Super Admin",
            _ => reporterRole
        };

        var reason = !string.IsNullOrWhiteSpace(req?.Message) ? req.Message.Trim() : "Issue reoccurred or requires further assistance";

        ticket.Status = "open";
        ticket.ResolutionNotes = null;
        ticket.ResolvedAt = null;
        ticket.UpdatedAt = DateTime.UtcNow;

        ticket.Timeline.Add(new PlatformTicketEvent
        {
            TicketId = ticket.Id,
            AuthorName = $"{reporterName} ({roleFormatted})",
            AuthorEmail = _currentUser.Email ?? "",
            Message = $"Ticket reopened by {reporterName} ({roleFormatted}). Reason: {reason}",
            Type = "status_change",
            CreatedAt = DateTime.UtcNow
        });

        _context.AuditLogs.Add(new AuditLog
        {
            Action = "support_ticket_reopened",
            EntityType = "PlatformTicket",
            EntityId = ticket.TicketNumber,
            ActorName = reporterName,
            ActorEmail = _currentUser.Email ?? "",
            CompanyId = ticket.TenantId,
            Details = $"Support ticket {ticket.TicketNumber} reopened by {reporterName}. Reason: {reason}",
            Module = "SupportDesk",
            Status = "success",
            Timestamp = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(ct);

        return Ok(ApiResponse<PlatformTicketDto>.SuccessResult(MapToDto(ticket), "Ticket reopened and dispatched to Platform Operations."));
    }

    private async Task<PlatformTicket?> FindTicketByIdOrNumberAsync(string id, CancellationToken ct)
    {
        if (int.TryParse(id, out var intId))
        {
            var byId = await _context.PlatformTickets
                .Include(t => t.Timeline.OrderBy(e => e.CreatedAt))
                .FirstOrDefaultAsync(t => t.Id == intId, ct);
            if (byId != null) return byId;
        }

        return await _context.PlatformTickets
            .Include(t => t.Timeline.OrderBy(e => e.CreatedAt))
            .FirstOrDefaultAsync(t => t.TicketNumber.ToLower() == id.Trim().ToLower(), ct);
    }

    private static PlatformTicketDto MapToDto(PlatformTicket t)
    {
        return new PlatformTicketDto
        {
            Id = t.Id.ToString(),
            TicketNumber = t.TicketNumber,
            Title = t.Title,
            Description = t.Description,
            Category = t.Category,
            Priority = t.Priority,
            Status = t.Status,
            TenantId = t.TenantId,
            TenantName = t.TenantName,
            TenantSlug = t.TenantSlug,
            ReportedByName = t.ReportedByName,
            ReportedByEmail = t.ReportedByEmail,
            AssignedToName = t.AssignedToName,
            AssignedToEmail = t.AssignedToEmail,
            ResolutionNotes = t.ResolutionNotes,
            ResolvedAt = t.ResolvedAt,
            CreatedAt = t.CreatedAt,
            UpdatedAt = t.UpdatedAt,
            Timeline = t.Timeline?.OrderBy(e => e.CreatedAt).Select(e => new TicketTimelineEventDto
            {
                Id = e.Id.ToString(),
                AuthorName = e.AuthorName,
                AuthorEmail = e.AuthorEmail,
                Message = e.Message,
                Type = e.Type,
                CreatedAt = e.CreatedAt
            }).ToList() ?? new List<TicketTimelineEventDto>()
        };
    }
}
