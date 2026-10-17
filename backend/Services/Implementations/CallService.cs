using System.Text.Json;
using backend.Authentication.Interfaces;
using backend.Data;
using backend.DTOs.Calls;
using backend.DTOs.Common;
using backend.Models.Entities;
using backend.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Implementations;

public class CallService(ApplicationDbContext context, ICurrentUserService currentUser) : ICallService
{
    public Task<PagedResult<CallRecordDto>> GetAsync(int page, int pageSize, string? direction, string? disposition, DateTime? from, DateTime? to, CancellationToken cancellationToken)
        => GetPagedAsync(page, pageSize, null, direction, disposition, from, to, null, null, null, cancellationToken);

    public async Task<PagedResult<CallRecordDto>> GetPagedAsync(int page, int pageSize, string? search, string? direction, string? disposition, DateTime? from, DateTime? to, int? agentId = null, int? leadId = null, int? customerId = null, CancellationToken cancellationToken = default)
    {
        var companyId = currentUser.CompanyId ?? 1;
        var query = context.Set<CallRecord>().AsNoTracking().Where(x => x.CompanyId == companyId);
        if (currentUser.Role == "sales_executive")
        {
            var uid = currentUser.UserId ?? 0;
            query = query.Where(x => x.AgentId == uid);
        }
        else if (agentId.HasValue)
        {
            query = query.Where(x => x.AgentId == agentId.Value);
        }
        if (leadId.HasValue) query = query.Where(x => x.LeadId == leadId.Value);
        if (customerId.HasValue) query = query.Where(x => x.CustomerId == customerId.Value);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(x => x.ContactName.ToLower().Contains(s) || x.ContactPhone.Contains(s) || (x.Notes != null && x.Notes.ToLower().Contains(s)));
        }
        if (!string.IsNullOrWhiteSpace(direction)) query = query.Where(x => x.Direction == direction.ToLower());
        if (!string.IsNullOrWhiteSpace(disposition)) query = query.Where(x => x.Disposition == disposition);
        if (from.HasValue) query = query.Where(x => x.Timestamp >= from.Value.ToUniversalTime());
        if (to.HasValue) query = query.Where(x => x.Timestamp <= to.Value.ToUniversalTime());
        var total = await query.CountAsync(cancellationToken);
        var items = await query.OrderByDescending(x => x.Timestamp).Skip((page - 1) * pageSize).Take(pageSize).Select(x => new CallRecordDto { Id = x.Id, CompanyId = x.CompanyId, AgentId = x.AgentId, ContactName = x.ContactName, ContactPhone = x.ContactPhone, Direction = x.Direction, Duration = x.Duration, Disposition = x.Disposition, Notes = x.Notes, Reason = x.Reason, CallModule = x.CallModule, LeadId = x.LeadId, CustomerId = x.CustomerId, Timestamp = x.Timestamp, CreatedAt = x.CreatedAt }).ToListAsync(cancellationToken);
        return new PagedResult<CallRecordDto> { Items = items, Page = page, PageSize = pageSize, TotalCount = total };
    }

    public async Task<ApiResponse<CallRecordDto>> LogAsync(LogCallDto request, CancellationToken cancellationToken)
    {
        var companyId = currentUser.CompanyId ?? 1;
        var agentId = currentUser.UserId ?? 1;

        int? validLeadId = request.LeadId;
        if (validLeadId.HasValue)
        {
            if (validLeadId.Value <= 0)
            {
                validLeadId = null;
            }
            else if (!context.Database.IsInMemory())
            {
                var lead = await context.Set<Lead>().FirstOrDefaultAsync(l => l.Id == validLeadId.Value && l.CompanyId == companyId, cancellationToken);
                if (lead != null)
                {
                    lead.UpdatedAt = DateTime.UtcNow;
                }
                else
                {
                    validLeadId = null;
                }
            }
        }

        int? validCustomerId = request.CustomerId;
        if (validCustomerId.HasValue)
        {
            if (validCustomerId.Value <= 0)
            {
                validCustomerId = null;
            }
            else if (!context.Database.IsInMemory())
            {
                var customer = await context.Set<Customer>().FirstOrDefaultAsync(c => c.Id == validCustomerId.Value && c.CompanyId == companyId, cancellationToken);
                if (customer != null)
                {
                    customer.LastContactedAt = DateTime.UtcNow;
                }
                else
                {
                    validCustomerId = null;
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
            Reason = request.Reason,
            CallModule = request.Module,
            LeadId = validLeadId,
            CustomerId = validCustomerId,
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

        int? validLeadId = request.LeadId;
        if (validLeadId.HasValue)
        {
            if (validLeadId.Value <= 0)
            {
                validLeadId = null;
            }
            else if (!context.Database.IsInMemory())
            {
                var leadExists = await context.Set<Lead>().AnyAsync(l => l.Id == validLeadId.Value && l.CompanyId == companyId, cancellationToken);
                if (!leadExists) validLeadId = null;
            }
        }

        int? validCustomerId = request.CustomerId;
        if (validCustomerId.HasValue)
        {
            if (validCustomerId.Value <= 0)
            {
                validCustomerId = null;
            }
            else if (!context.Database.IsInMemory())
            {
                var customerExists = await context.Set<Customer>().AnyAsync(c => c.Id == validCustomerId.Value && c.CompanyId == companyId, cancellationToken);
                if (!customerExists) validCustomerId = null;
            }
        }

        CallRecord? record = request.CallId.HasValue
            ? await context.Set<CallRecord>().FirstOrDefaultAsync(x => x.Id == request.CallId && x.CompanyId == companyId && x.AgentId == agentId, cancellationToken)
            : null;

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
                LeadId = validLeadId,
                CustomerId = validCustomerId,
                Timestamp = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow
            };
            context.Set<CallRecord>().Add(record);
        }

        record.Disposition = request.Disposition;
        record.Notes = request.Notes;
        if (!string.IsNullOrWhiteSpace(request.Reason)) record.Reason = request.Reason;
        if (!string.IsNullOrWhiteSpace(request.Module)) record.CallModule = request.Module;

        Followup? newFollowup = null;
        if (validLeadId.HasValue)
        {
            var lead = await context.Set<Lead>().FirstOrDefaultAsync(x => x.Id == validLeadId.Value && x.CompanyId == companyId, cancellationToken);
            if (lead != null)
            {
                if (request.Disposition is "Interested" or "Not Interested" or "Wrong Number")
                {
                    lead.Status = request.Disposition == "Wrong Number" ? "Junk" : request.Disposition;
                    lead.UpdatedAt = DateTime.UtcNow;

                    if (request.Disposition is "Not Interested" or "Wrong Number" or "Junk")
                    {
                        var cf = DeserializeCustomFields(lead.CustomFieldsJson);
                        cf["dispositionReason"] = !string.IsNullOrWhiteSpace(request.Notes) ? request.Notes : request.Disposition;
                        lead.CustomFieldsJson = JsonSerializer.Serialize(cf);
                        if (!string.IsNullOrWhiteSpace(request.Notes))
                        {
                            lead.Notes = string.IsNullOrWhiteSpace(lead.Notes)
                                ? $"[{DateTime.UtcNow:yyyy-MM-dd}] {request.Disposition}: {request.Notes}"
                                : $"{lead.Notes}\n\n[{DateTime.UtcNow:yyyy-MM-dd}] {request.Disposition}: {request.Notes}";
                        }
                        await backend.Services.Implementations.InterestedLeadConversion.RemoveSalesFollowupsAsync(context, lead, cancellationToken);
                    }

                    if (request.Disposition == "Interested")
                    {
                        await backend.Services.Implementations.InterestedLeadConversion.RemoveSalesFollowupsAsync(context, lead, cancellationToken);
                    }
                }
                else if (request.Disposition is "Follow-up Required" or "Follow Up Required")
                {
                    lead.Status = "Follow-up Required";
                    if (request.FollowupAt.HasValue) lead.NextFollowupDate = request.FollowupAt.Value;
                }
                else if (request.Disposition is "Call Back")
                {
                    lead.Status = "Callback";
                    if (request.FollowupAt.HasValue) lead.NextFollowupDate = request.FollowupAt.Value;
                }
                else if (request.Disposition is "No Response")
                {
                    lead.Status = "No Response";
                    if (request.FollowupAt.HasValue) lead.NextFollowupDate = request.FollowupAt.Value;
                }
                else if (request.Disposition is "Other")
                {
                    lead.Status = "Other";

                    var leadIdStr = lead.Id.ToString();
                    var leadPrefixedStr = $"lead-{lead.Id}";
                    var cleanLeadPhone = lead.Phone ?? request.ContactPhone ?? string.Empty;
                    var phoneDigits = System.Text.RegularExpressions.Regex.Replace(cleanLeadPhone, @"\D", "");
                    var last10 = phoneDigits.Length >= 10 ? phoneDigits.Substring(phoneDigits.Length - 10) : phoneDigits;

                    var pendingFollowups = await context.Set<Followup>()
                        .Where(f => f.CompanyId == lead.CompanyId &&
                                    f.Status == backend.Models.Enums.FollowupStatus.Pending &&
                                    (f.ContactId == leadIdStr ||
                                     f.ContactId == leadPrefixedStr ||
                                     (!string.IsNullOrEmpty(last10) && f.ContactPhone.Contains(last10))))
                        .ToListAsync(cancellationToken);
                    foreach (var pf in pendingFollowups)
                    {
                        pf.Status = backend.Models.Enums.FollowupStatus.Completed;
                        pf.OutcomeNotes = $"Reclassified to Other: {request.Reason ?? "Marked as Other"}";
                        pf.UpdatedAt = DateTime.UtcNow;
                    }
                }

                if (request.Disposition is "Follow-up Required" or "Follow Up Required" or "Call Back" or "No Response")
                {
                    var agentUser = await context.Set<User>().Include(u => u.Role).FirstOrDefaultAsync(u => u.Id == agentId, cancellationToken);
                    newFollowup = new Followup
                    {
                        CompanyId = companyId,
                        AssignedAgentId = agentId,
                        AssignedToName = agentUser?.Name ?? string.Empty,
                        AssignedToRole = agentUser?.Role?.Code ?? "sales_executive",
                        LeadId = lead.Id,
                        ContactId = lead.Id.ToString(),
                        ContactType = "lead",
                        ContactName = lead.Name ?? string.Empty,
                        ContactPhone = lead.Phone ?? string.Empty,
                        ContactEmail = lead.Email,
                        ScheduledAt = request.FollowupAt ?? DateTime.UtcNow.AddDays(1),
                        Notes = request.Notes ?? string.Empty,
                        HandoverId = lead.HandoverId,
                        OriginalOwnerId = lead.OriginalOwnerId,
                        CreatedAt = DateTime.UtcNow
                    };
                    context.Set<Followup>().Add(newFollowup);
                }
            }
        }

        if (validCustomerId.HasValue)
        {
            var customer = await context.Set<Customer>().FirstOrDefaultAsync(x => x.Id == validCustomerId.Value && x.CompanyId == companyId, cancellationToken);
            if (customer != null)
            {
                customer.LastContactedAt = DateTime.UtcNow;
                customer.UpdatedAt = DateTime.UtcNow;

                if (request.Disposition is "Follow-up Required" or "Follow Up Required" or "Call Back" or "No Response")
                {
                    var agentUser = await context.Set<User>().Include(u => u.Role).FirstOrDefaultAsync(u => u.Id == agentId, cancellationToken);
                    var customerFollowup = new Followup
                    {
                        CompanyId = companyId,
                        AssignedAgentId = agentId,
                        AssignedToName = agentUser?.Name ?? string.Empty,
                        AssignedToRole = agentUser?.Role?.Code ?? "sales_executive",
                        CustomerId = customer.Id,
                        ContactId = customer.Id.ToString(),
                        ContactType = "customer",
                        ContactName = customer.Name,
                        ContactPhone = customer.Phone,
                        ScheduledAt = request.FollowupAt ?? DateTime.UtcNow.AddDays(1),
                        Notes = request.Notes ?? string.Empty,
                        CreatedAt = DateTime.UtcNow
                    };
                    context.Set<Followup>().Add(customerFollowup);
                }
            }
        }

        await context.SaveChangesAsync(cancellationToken);

        if (newFollowup != null && newFollowup.HandoverId.HasValue)
        {
            context.Set<WorkHandoverItem>().Add(new WorkHandoverItem
            {
                HandoverId = newFollowup.HandoverId.Value,
                EntityType = "Followup",
                EntityId = newFollowup.Id,
                Origin = "created_during_coverage"
            });
            await context.SaveChangesAsync(cancellationToken);
        }

        return ApiResponse<CallRecordDto>.SuccessResult(Map(record), "Disposition processed");
    }

    private static CallRecordDto Map(CallRecord x) => new() { Id = x.Id, CompanyId = x.CompanyId, AgentId = x.AgentId, ContactName = x.ContactName, ContactPhone = x.ContactPhone, Direction = x.Direction, Duration = x.Duration, Disposition = x.Disposition, Notes = x.Notes, Reason = x.Reason, CallModule = x.CallModule, LeadId = x.LeadId, CustomerId = x.CustomerId, Timestamp = x.Timestamp, CreatedAt = x.CreatedAt };

    private static Dictionary<string, string> DeserializeCustomFields(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new Dictionary<string, string>();
        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, string>>(json) ?? new Dictionary<string, string>();
        }
        catch
        {
            return new Dictionary<string, string>();
        }
    }
}
