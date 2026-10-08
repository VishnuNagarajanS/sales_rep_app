using backend.Authentication.Interfaces;
using backend.Data;
using backend.DTOs.Calls;
using backend.DTOs.Common;
using backend.Models.Entities;
using backend.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Implementations;

public sealed class CallService(ApplicationDbContext context, ICurrentUserService currentUser) : ICallService
{
    public async Task<PagedResult<CallRecordDto>> GetAsync(int page, int pageSize, string? direction, string? disposition, DateTime? from, DateTime? to, CancellationToken cancellationToken)
    {
        var canViewCompanyCalls = string.Equals(currentUser.Role, "company_admin", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(currentUser.Role, "super_admin", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(currentUser.Role, "admin", StringComparison.OrdinalIgnoreCase);
        var query = context.Set<CallRecord>().AsNoTracking().Where(x => x.CompanyId == currentUser.CompanyId);
        if (!canViewCompanyCalls && currentUser.UserId.HasValue)
        {
            query = query.Where(x => x.AgentId == currentUser.UserId.Value);
        }
        if (!string.IsNullOrWhiteSpace(direction)) query = query.Where(x => x.Direction == direction.ToLower());
        if (!string.IsNullOrWhiteSpace(disposition)) query = query.Where(x => x.Disposition == disposition);
        if (from.HasValue) query = query.Where(x => x.Timestamp >= from.Value.ToUniversalTime());
        if (to.HasValue) query = query.Where(x => x.Timestamp <= to.Value.ToUniversalTime());
        var total = await query.CountAsync(cancellationToken);
        var items = await query.OrderByDescending(x => x.Timestamp).Skip((page - 1) * pageSize).Take(pageSize).Select(x => new CallRecordDto { Id = x.Id, CompanyId = x.CompanyId, AgentId = x.AgentId, ContactName = x.ContactName, ContactPhone = x.ContactPhone, Direction = x.Direction, Duration = x.Duration, Disposition = x.Disposition, Notes = x.Notes, LeadId = x.LeadId, CustomerId = x.CustomerId, Timestamp = x.Timestamp, CreatedAt = x.CreatedAt }).ToListAsync(cancellationToken);
        return new PagedResult<CallRecordDto> { Items = items, Page = page, PageSize = pageSize, TotalCount = total };
    }

    public async Task<ApiResponse<CallRecordDto>> LogAsync(LogCallDto request, CancellationToken cancellationToken)
    {
        var companyId = currentUser.CompanyId ?? 1;
        var agentId = currentUser.UserId ?? 1;
        if (!await context.Users.AnyAsync(u => u.Id == agentId && u.CompanyId == companyId, cancellationToken))
            return ApiResponse<CallRecordDto>.FailureResult("The current agent does not belong to this company.");

        int? customerId = request.CustomerId;
        int? leadId = request.LeadId;
        if (customerId.HasValue && leadId.HasValue)
            return ApiResponse<CallRecordDto>.FailureResult("A call can be linked to either a lead or a customer, not both.");

        if (leadId.HasValue)
        {
            var lead = await context.Set<Lead>().FirstOrDefaultAsync(l => l.Id == leadId.Value && l.CompanyId == companyId, cancellationToken);
            if (lead == null) return ApiResponse<CallRecordDto>.FailureResult("Selected lead was not found in this company.");
            lead.UpdatedAt = DateTime.UtcNow;
        }
        if (customerId.HasValue)
        {
            var customer = await context.Set<Customer>().FirstOrDefaultAsync(c => c.Id == customerId.Value && c.CompanyId == companyId, cancellationToken);
            if (customer == null) return ApiResponse<CallRecordDto>.FailureResult("Selected customer was not found in this company.");
            customer.LastContactedAt = DateTime.UtcNow;
        }

        // Auto-resolve customer or lead by phone if not explicitly provided
        if (!customerId.HasValue && !leadId.HasValue && !string.IsNullOrWhiteSpace(request.ContactPhone))
        {
            var phone = request.ContactPhone.Trim();
            var customer = await context.Set<Customer>().FirstOrDefaultAsync(c => c.CompanyId == companyId && c.Phone == phone, cancellationToken);
            if (customer != null)
            {
                customerId = customer.Id;
                customer.LastContactedAt = DateTime.UtcNow;
            }
            else
            {
                var lead = await context.Set<Lead>().FirstOrDefaultAsync(l => l.CompanyId == companyId && l.Phone == phone, cancellationToken);
                if (lead != null)
                {
                    leadId = lead.Id;
                    lead.UpdatedAt = DateTime.UtcNow;
                }
            }
        }
        var record = new CallRecord
        {
            CompanyId = companyId,
            AgentId = agentId,
            ContactName = request.ContactName,
            ContactPhone = request.ContactPhone,
            Direction = request.Direction.ToLowerInvariant(),
            Duration = request.Duration,
            Disposition = request.Disposition,
            Notes = request.Notes,
            LeadId = leadId,
            CustomerId = customerId,
            Timestamp = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        };

        context.Set<CallRecord>().Add(record);
        await context.SaveChangesAsync(cancellationToken);
        return ApiResponse<CallRecordDto>.SuccessResult(Map(record), "Call logged");
    }

    public async Task<ApiResponse<CallRecordDto>> ProcessDispositionAsync(CallDispositionDto request, CancellationToken cancellationToken)
    {
        var companyId = currentUser.CompanyId ?? 1;
        var agentId = currentUser.UserId ?? 1;
        if (!await context.Users.AnyAsync(u => u.Id == agentId && u.CompanyId == companyId, cancellationToken))
            return ApiResponse<CallRecordDto>.FailureResult("The current agent does not belong to this company.");

        CallRecord? record = request.CallId.HasValue
            ? await context.Set<CallRecord>().FirstOrDefaultAsync(x => x.Id == request.CallId && x.CompanyId == companyId && x.AgentId == agentId, cancellationToken)
            : null;

        if (request.LeadId.HasValue && request.CustomerId.HasValue)
            return ApiResponse<CallRecordDto>.FailureResult("A call can be linked to either a lead or a customer, not both.");

        var contactWasSelected = request.LeadId.HasValue || request.CustomerId.HasValue;
        int? leadId = contactWasSelected ? request.LeadId : record?.LeadId;
        int? customerId = contactWasSelected ? request.CustomerId : record?.CustomerId;

        // Auto-resolve customer or lead if neither is passed
        if (!leadId.HasValue && !customerId.HasValue && !string.IsNullOrWhiteSpace(request.ContactPhone))
        {
            var phone = request.ContactPhone.Trim();
            var custMatch = await context.Set<Customer>().FirstOrDefaultAsync(c => c.CompanyId == companyId && c.Phone == phone, cancellationToken);
            if (custMatch != null)
            {
                customerId = custMatch.Id;
            }
            else
            {
                var leadMatch = await context.Set<Lead>().FirstOrDefaultAsync(l => l.CompanyId == companyId && l.Phone == phone, cancellationToken);
                if (leadMatch != null)
                {
                    leadId = leadMatch.Id;
                }
            }
        }

        if (leadId.HasValue && !await context.Set<Lead>().AnyAsync(l => l.Id == leadId.Value && l.CompanyId == companyId, cancellationToken))
            return ApiResponse<CallRecordDto>.FailureResult("Selected lead was not found in this company.");
        if (customerId.HasValue && !await context.Set<Customer>().AnyAsync(c => c.Id == customerId.Value && c.CompanyId == companyId, cancellationToken))
            return ApiResponse<CallRecordDto>.FailureResult("Selected customer was not found in this company.");

        if (record == null)
        {
            record = new CallRecord
            {
                CompanyId = companyId,
                AgentId = agentId,
                ContactName = request.ContactName,
                ContactPhone = request.ContactPhone,
                Direction = request.Direction.ToLowerInvariant(),
                Duration = request.Duration,
                LeadId = leadId,
                CustomerId = customerId,
                Timestamp = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow
            };
            context.Set<CallRecord>().Add(record);
        }
        else
        {
            record.LeadId = leadId;
            record.CustomerId = customerId;
        }

        record.Disposition = request.Disposition;
        record.Notes = request.Notes;

        var schedTime = request.FollowupAt.HasValue
            ? (request.FollowupAt.Value.Kind == DateTimeKind.Unspecified
                ? DateTime.SpecifyKind(request.FollowupAt.Value, DateTimeKind.Utc)
                : request.FollowupAt.Value.ToUniversalTime())
            : DateTime.UtcNow.AddDays(1);

        if (leadId.HasValue)
        {
            var lead = await context.Set<Lead>().FirstOrDefaultAsync(x => x.Id == leadId.Value && x.CompanyId == companyId, cancellationToken);
            if (lead != null)
            {
                if (request.Disposition is "Interested" or "Not Interested" or "Wrong Number")
                    lead.Status = request.Disposition == "Wrong Number" ? "Junk" : request.Disposition;
                lead.UpdatedAt = DateTime.UtcNow;

                if (request.Disposition is "Follow-up Required" or "Call Back")
                {
                    lead.NextFollowupDate = schedTime;
                    context.Set<Followup>().Add(new Followup
                    {
                        CompanyId = companyId,
                        AssignedAgentId = agentId,
                        LeadId = lead.Id,
                        ContactId = lead.Id.ToString(),
                        ContactType = "lead",
                        ContactName = lead.Name,
                        ContactPhone = lead.Phone,
                        ScheduledAt = schedTime,
                        Notes = request.Notes ?? string.Empty,
                        CreatedAt = DateTime.UtcNow
                    });
                }
            }
        }
        else if (customerId.HasValue)
        {
            var customer = await context.Set<Customer>().FirstOrDefaultAsync(x => x.Id == customerId.Value && x.CompanyId == companyId, cancellationToken);
            if (customer != null)
            {
                customer.LastContactedAt = DateTime.UtcNow;
                customer.UpdatedAt = DateTime.UtcNow;

                if (request.Disposition is "Follow-up Required" or "Call Back")
                {
                    context.Set<Followup>().Add(new Followup
                    {
                        CompanyId = companyId,
                        AssignedAgentId = agentId,
                        CustomerId = customer.Id,
                        ContactId = customer.Id.ToString(),
                        ContactType = "customer",
                        ContactName = customer.Name,
                        ContactPhone = customer.Phone,
                        ScheduledAt = schedTime,
                        Notes = request.Notes ?? string.Empty,
                        CreatedAt = DateTime.UtcNow
                    });
                }
            }
        }

        await context.SaveChangesAsync(cancellationToken);
        return ApiResponse<CallRecordDto>.SuccessResult(Map(record), "Disposition processed");
    }

    private static CallRecordDto Map(CallRecord x) => new() { Id = x.Id, CompanyId = x.CompanyId, AgentId = x.AgentId, ContactName = x.ContactName, ContactPhone = x.ContactPhone, Direction = x.Direction, Duration = x.Duration, Disposition = x.Disposition, Notes = x.Notes, LeadId = x.LeadId, CustomerId = x.CustomerId, Timestamp = x.Timestamp, CreatedAt = x.CreatedAt };
}
