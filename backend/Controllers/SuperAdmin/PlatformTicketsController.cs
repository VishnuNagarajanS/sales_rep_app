using backend.Authentication.Interfaces;
using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.SuperAdmin;
using backend.Models.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers.SuperAdmin;

[ApiController]
[Authorize(Roles = "super_admin")]
[Route("api/super-admin/tickets")]
public class PlatformTicketsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public PlatformTicketsController(ApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<PlatformTicketDto>>>> GetTickets(
        [FromQuery] string? status = null,
        [FromQuery] string? priority = null,
        [FromQuery] string? category = null,
        [FromQuery] int? tenantId = null,
        [FromQuery] string? search = null,
        CancellationToken ct = default)
    {
        var query = _context.PlatformTickets
            .Include(t => t.Timeline)
            .AsNoTracking()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            var s = status.Trim().ToLowerInvariant();
            query = query.Where(t => t.Status.ToLower() == s);
        }

        if (!string.IsNullOrWhiteSpace(priority) && !priority.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            var p = priority.Trim().ToLowerInvariant();
            if (p == "critical_high" || p == "critical,high")
            {
                query = query.Where(t => t.Priority.ToLower() == "critical" || t.Priority.ToLower() == "high");
            }
            else
            {
                query = query.Where(t => t.Priority.ToLower() == p);
            }
        }

        if (!string.IsNullOrWhiteSpace(category) && !category.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            var c = category.Trim().ToLowerInvariant();
            query = query.Where(t => t.Category.ToLower() == c);
        }

        if (tenantId.HasValue && tenantId.Value > 0)
        {
            query = query.Where(t => t.TenantId == tenantId.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLowerInvariant();
            query = query.Where(t =>
                t.TicketNumber.ToLower().Contains(term) ||
                t.Title.ToLower().Contains(term) ||
                t.Description.ToLower().Contains(term) ||
                t.Category.ToLower().Contains(term) ||
                (t.TenantName != null && t.TenantName.ToLower().Contains(term)) ||
                (t.ReportedByName != null && t.ReportedByName.ToLower().Contains(term)) ||
                (t.ReportedByEmail != null && t.ReportedByEmail.ToLower().Contains(term)) ||
                (t.AssignedToName != null && t.AssignedToName.ToLower().Contains(term))
            );
        }

        var tickets = await query
            .Include(t => t.Timeline)
            .OrderByDescending(t => t.Priority == "critical")
            .ThenByDescending(t => t.Priority == "high")
            .ThenByDescending(t => t.CreatedAt)
            .ToListAsync(ct);

        var dtos = tickets.Select(MapToDto).ToList();
        return Ok(ApiResponse<List<PlatformTicketDto>>.SuccessResult(dtos, "Platform support tickets retrieved."));
    }

    [HttpGet("metrics")]
    public async Task<ActionResult<ApiResponse<PlatformTicketMetricsDto>>> GetTicketMetrics(CancellationToken ct = default)
    {
        var total = await _context.PlatformTickets.CountAsync(ct);
        var critical = await _context.PlatformTickets.CountAsync(t => t.Priority == "critical" || t.Priority == "high", ct);
        var inProgress = await _context.PlatformTickets.CountAsync(t => t.Status == "in_progress" || t.Status == "escalated", ct);
        var resolved = await _context.PlatformTickets.CountAsync(t => t.Status == "resolved" || t.Status == "closed", ct);
        var open = await _context.PlatformTickets.CountAsync(t => t.Status == "open", ct);

        var statusGroups = await _context.PlatformTickets
            .GroupBy(t => t.Status.ToLower())
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var priorityGroups = await _context.PlatformTickets
            .GroupBy(t => t.Priority.ToLower())
            .Select(g => new { Priority = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var statusCounts = new Dictionary<string, int>
        {
            ["open"] = 0,
            ["in_progress"] = 0,
            ["escalated"] = 0,
            ["resolved"] = 0,
            ["closed"] = 0
        };

        foreach (var sg in statusGroups)
        {
            statusCounts[sg.Status] = sg.Count;
        }

        var priorityCounts = new Dictionary<string, int>
        {
            ["critical"] = 0,
            ["high"] = 0,
            ["medium"] = 0,
            ["low"] = 0
        };

        foreach (var pg in priorityGroups)
        {
            priorityCounts[pg.Priority] = pg.Count;
        }

        var metrics = new PlatformTicketMetricsDto
        {
            Total = total,
            Critical = critical,
            InProgress = inProgress,
            Resolved = resolved,
            Open = open,
            StatusCounts = statusCounts,
            PriorityCounts = priorityCounts
        };

        return Ok(ApiResponse<PlatformTicketMetricsDto>.SuccessResult(metrics, "Platform ticket telemetry metrics calculated."));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<PlatformTicketDto>>> GetTicketById(string id, CancellationToken ct = default)
    {
        var ticket = await FindTicketByIdOrNumberAsync(id, ct);
        if (ticket == null)
        {
            return NotFound(ApiResponse<PlatformTicketDto>.FailureResult($"Ticket \"{id}\" not found."));
        }

        return Ok(ApiResponse<PlatformTicketDto>.SuccessResult(MapToDto(ticket)));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<PlatformTicketDto>>> CreateTicket(
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

        string? tenantName = null;
        string? tenantSlug = null;
        if (req.TenantId.HasValue && req.TenantId.Value > 0)
        {
            var tenant = await _context.Tenants.FindAsync(new object[] { req.TenantId.Value }, ct);
            if (tenant != null)
            {
                tenantName = tenant.Name;
                tenantSlug = tenant.Slug;
            }
        }

        var authorEmail = _currentUser.Email ?? "superadmin@nexusplatform.io";
        var authorName = _currentUser.Email ?? "Super Admin";

        var maxId = await _context.PlatformTickets.MaxAsync(t => (int?)t.Id, ct) ?? 0;
        var ticketNumber = $"INC-{DateTime.UtcNow.Year}-{1001 + maxId}";

        var assignedTo = string.IsNullOrWhiteSpace(req.AssignedToName) ? "Platform Operations" : req.AssignedToName.Trim();

        var ticket = new PlatformTicket
        {
            TicketNumber = ticketNumber,
            Title = req.Title.Trim(),
            Description = req.Description.Trim(),
            Category = string.IsNullOrWhiteSpace(req.Category) ? "Telephony / Carrier Trunk" : req.Category.Trim(),
            Priority = string.IsNullOrWhiteSpace(req.Priority) ? "medium" : req.Priority.Trim().ToLowerInvariant(),
            Status = "open",
            TenantId = req.TenantId > 0 ? req.TenantId : null,
            TenantName = tenantName,
            TenantSlug = tenantSlug,
            ReportedByName = string.IsNullOrWhiteSpace(req.ReportedByName) ? authorName : req.ReportedByName.Trim(),
            ReportedByEmail = string.IsNullOrWhiteSpace(req.ReportedByEmail) ? authorEmail : req.ReportedByEmail.Trim(),
            AssignedToName = assignedTo,
            AssignedToEmail = req.AssignedToEmail?.Trim(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Timeline = new List<PlatformTicketEvent>
            {
                new()
                {
                    AuthorName = authorName,
                    AuthorEmail = authorEmail,
                    Message = $"Incident ticket {ticketNumber} logged and dispatched to {assignedTo}.",
                    Type = "system_alert",
                    CreatedAt = DateTime.UtcNow
                }
            }
        };

        _context.PlatformTickets.Add(ticket);
        await _context.SaveChangesAsync(ct);

        _context.AuditLogs.Add(new AuditLog
        {
            Action = "ticket_created",
            EntityType = "PlatformTicket",
            EntityId = ticket.TicketNumber,
            ActorName = authorName,
            ActorEmail = authorEmail,
            CompanyId = ticket.TenantId,
            Details = $"Super Admin logged technical incident {ticket.TicketNumber}: \"{ticket.Title}\" ({ticket.Priority.ToUpperInvariant()}).",
            Module = "SupportDesk",
            Status = "success",
            Timestamp = DateTime.UtcNow
        });
        await _context.SaveChangesAsync(ct);

        return Ok(ApiResponse<PlatformTicketDto>.SuccessResult(MapToDto(ticket), "Platform support ticket logged successfully."));
    }

    [HttpPut("{id}/status")]
    [HttpPatch("{id}/status")]
    public async Task<ActionResult<ApiResponse<PlatformTicketDto>>> UpdateStatus(
        string id,
        [FromBody] UpdateTicketStatusRequestDto req,
        CancellationToken ct = default)
    {
        var ticket = await FindTicketByIdOrNumberAsync(id, ct);
        if (ticket == null)
        {
            return NotFound(ApiResponse<PlatformTicketDto>.FailureResult($"Ticket \"{id}\" not found."));
        }

        var oldStatus = ticket.Status;
        var nextStatus = req.Status.Trim().ToLowerInvariant();
        ticket.Status = nextStatus;
        ticket.UpdatedAt = DateTime.UtcNow;

        if (nextStatus == "resolved" || nextStatus == "closed")
        {
            ticket.ResolvedAt = DateTime.UtcNow;
            if (!string.IsNullOrWhiteSpace(req.ResolutionNotes))
            {
                ticket.ResolutionNotes = req.ResolutionNotes.Trim();
            }
        }
        else if (oldStatus == "resolved" || oldStatus == "closed")
        {
            // Reopening ticket
            ticket.ResolvedAt = null;
        }

        var authorEmail = _currentUser.Email ?? "superadmin@nexusplatform.io";
        var authorName = _currentUser.Email ?? "Super Admin";

        var isReopen = (oldStatus == "resolved" || oldStatus == "closed") && (nextStatus == "open" || nextStatus == "in_progress" || nextStatus == "escalated");
        var eventType = isReopen ? "reopen" : "status_change";

        var message = isReopen
            ? $"Ticket REOPENED: Status transitioned from {oldStatus.ToUpperInvariant()} to {nextStatus.ToUpperInvariant()}." +
              (!string.IsNullOrWhiteSpace(req.Note) ? $" Note: {req.Note}" : "")
            : $"Status transitioned from {oldStatus.ToUpperInvariant()} to {nextStatus.ToUpperInvariant()}." +
              (!string.IsNullOrWhiteSpace(req.Note) ? $" Note: {req.Note}" : "") +
              (!string.IsNullOrWhiteSpace(req.ResolutionNotes) ? $" Resolution: {req.ResolutionNotes}" : "");

        ticket.Timeline.Add(new PlatformTicketEvent
        {
            TicketId = ticket.Id,
            AuthorName = authorName,
            AuthorEmail = authorEmail,
            Message = message,
            Type = eventType,
            CreatedAt = DateTime.UtcNow
        });

        _context.AuditLogs.Add(new AuditLog
        {
            Action = "ticket_status_update",
            EntityType = "PlatformTicket",
            EntityId = ticket.TicketNumber,
            ActorName = authorName,
            ActorEmail = authorEmail,
            CompanyId = ticket.TenantId,
            Details = $"Ticket {ticket.TicketNumber} transitioned to {ticket.Status.ToUpperInvariant()}.",
            Module = "SupportDesk",
            Status = "success",
            Timestamp = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(ct);

        return Ok(ApiResponse<PlatformTicketDto>.SuccessResult(MapToDto(ticket), $"Ticket status changed to {ticket.Status}."));
    }

    [HttpPut("{id}/priority")]
    [HttpPatch("{id}/priority")]
    public async Task<ActionResult<ApiResponse<PlatformTicketDto>>> UpdatePriority(
        string id,
        [FromBody] UpdateTicketPriorityRequestDto req,
        CancellationToken ct = default)
    {
        var ticket = await FindTicketByIdOrNumberAsync(id, ct);
        if (ticket == null)
        {
            return NotFound(ApiResponse<PlatformTicketDto>.FailureResult($"Ticket \"{id}\" not found."));
        }

        var oldPriority = ticket.Priority;
        var nextPriority = (!string.IsNullOrWhiteSpace(req.Priority) ? req.Priority : req.Status)?.Trim().ToLowerInvariant() ?? "medium";

        ticket.Priority = nextPriority;
        ticket.UpdatedAt = DateTime.UtcNow;

        var authorEmail = _currentUser.Email ?? "superadmin@nexusplatform.io";
        var authorName = _currentUser.Email ?? "Super Admin";

        ticket.Timeline.Add(new PlatformTicketEvent
        {
            TicketId = ticket.Id,
            AuthorName = authorName,
            AuthorEmail = authorEmail,
            Message = $"Priority updated from {oldPriority.ToUpperInvariant()} to {ticket.Priority.ToUpperInvariant()}." +
                      (!string.IsNullOrWhiteSpace(req.Note) ? $" Note: {req.Note}" : ""),
            Type = "priority_change",
            CreatedAt = DateTime.UtcNow
        });

        _context.AuditLogs.Add(new AuditLog
        {
            Action = "ticket_priority_update",
            EntityType = "PlatformTicket",
            EntityId = ticket.TicketNumber,
            ActorName = authorName,
            ActorEmail = authorEmail,
            CompanyId = ticket.TenantId,
            Details = $"Ticket {ticket.TicketNumber} priority updated to {ticket.Priority.ToUpperInvariant()}.",
            Module = "SupportDesk",
            Status = "success",
            Timestamp = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(ct);

        return Ok(ApiResponse<PlatformTicketDto>.SuccessResult(MapToDto(ticket), $"Priority updated to {ticket.Priority}."));
    }

    [HttpPut("{id}/assign")]
    [HttpPatch("{id}/assign")]
    public async Task<ActionResult<ApiResponse<PlatformTicketDto>>> AssignTicket(
        string id,
        [FromBody] AssignTicketRequestDto req,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(req.AssignedToName))
        {
            return BadRequest(ApiResponse<PlatformTicketDto>.FailureResult("Assignee name cannot be empty."));
        }

        var ticket = await FindTicketByIdOrNumberAsync(id, ct);
        if (ticket == null)
        {
            return NotFound(ApiResponse<PlatformTicketDto>.FailureResult($"Ticket \"{id}\" not found."));
        }

        var oldAssignee = ticket.AssignedToName ?? "Unassigned";
        ticket.AssignedToName = req.AssignedToName.Trim();
        ticket.AssignedToEmail = req.AssignedToEmail?.Trim();
        ticket.UpdatedAt = DateTime.UtcNow;

        var authorEmail = _currentUser.Email ?? "superadmin@nexusplatform.io";
        var authorName = _currentUser.Email ?? "Super Admin";

        ticket.Timeline.Add(new PlatformTicketEvent
        {
            TicketId = ticket.Id,
            AuthorName = authorName,
            AuthorEmail = authorEmail,
            Message = $"Ticket reassigned from {oldAssignee} to {ticket.AssignedToName}." +
                      (!string.IsNullOrWhiteSpace(req.Note) ? $" Note: {req.Note}" : ""),
            Type = "assignment_change",
            CreatedAt = DateTime.UtcNow
        });

        _context.AuditLogs.Add(new AuditLog
        {
            Action = "ticket_assigned",
            EntityType = "PlatformTicket",
            EntityId = ticket.TicketNumber,
            ActorName = authorName,
            ActorEmail = authorEmail,
            CompanyId = ticket.TenantId,
            Details = $"Ticket {ticket.TicketNumber} assigned to {ticket.AssignedToName}.",
            Module = "SupportDesk",
            Status = "success",
            Timestamp = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(ct);

        return Ok(ApiResponse<PlatformTicketDto>.SuccessResult(MapToDto(ticket), $"Ticket assigned to {ticket.AssignedToName}."));
    }

    [HttpPost("{id}/notes")]
    public async Task<ActionResult<ApiResponse<PlatformTicketDto>>> AddNote(
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

        var authorEmail = _currentUser.Email ?? "superadmin@nexusplatform.io";
        var authorName = _currentUser.Email ?? "Super Admin";

        ticket.Timeline.Add(new PlatformTicketEvent
        {
            TicketId = ticket.Id,
            AuthorName = authorName,
            AuthorEmail = authorEmail,
            Message = req.Message.Trim(),
            Type = "note",
            CreatedAt = DateTime.UtcNow
        });
        ticket.UpdatedAt = DateTime.UtcNow;

        _context.AuditLogs.Add(new AuditLog
        {
            Action = "ticket_note_added",
            EntityType = "PlatformTicket",
            EntityId = ticket.TicketNumber,
            ActorName = authorName,
            ActorEmail = authorEmail,
            CompanyId = ticket.TenantId,
            Details = $"Diagnostic note appended to ticket {ticket.TicketNumber}.",
            Module = "SupportDesk",
            Status = "success",
            Timestamp = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(ct);

        return Ok(ApiResponse<PlatformTicketDto>.SuccessResult(MapToDto(ticket), "Investigation note appended."));
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteTicket(string id, CancellationToken ct = default)
    {
        var ticket = await FindTicketByIdOrNumberAsync(id, ct);
        if (ticket == null)
        {
            return NotFound(ApiResponse<bool>.FailureResult($"Ticket \"{id}\" not found."));
        }

        _context.PlatformTickets.Remove(ticket);

        _context.AuditLogs.Add(new AuditLog
        {
            Action = "ticket_deleted",
            EntityType = "PlatformTicket",
            EntityId = ticket.TicketNumber,
            ActorName = _currentUser.Email ?? "Super Admin",
            ActorEmail = _currentUser.Email ?? "superadmin@nexusplatform.io",
            CompanyId = ticket.TenantId,
            Details = $"Ticket {ticket.TicketNumber} deleted by Super Admin.",
            Module = "SupportDesk",
            Status = "success",
            Timestamp = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(ct);

        return Ok(ApiResponse<bool>.SuccessResult(true, "Ticket removed."));
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
