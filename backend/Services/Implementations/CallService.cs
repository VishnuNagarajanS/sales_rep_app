using backend.Authentication.Interfaces;
using backend.Data;
using backend.DTOs.Calls;
using backend.DTOs.Common;
using backend.Models.Entities;
using backend.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace backend.Services.Implementations;

public sealed class CallService(ApplicationDbContext context, ICurrentUserService currentUser) : ICallService
{
    public async Task<PagedResult<CallRecordDto>> GetAsync(int page, int pageSize, string? direction, string? disposition, DateTime? from, DateTime? to, CancellationToken cancellationToken)
    {
        page = Math.Max(page, 1); pageSize = Math.Clamp(pageSize, 1, 100);
        var query = context.Set<CallRecord>().AsNoTracking().Where(x => x.CompanyId == currentUser.CompanyId && x.AgentId == currentUser.UserId);
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
        if (!currentUser.UserId.HasValue || currentUser.UserId.Value <= 0)
            return ApiResponse<CallRecordDto>.FailureResult("Unauthorized: User ID is missing.");
        if (!currentUser.CompanyId.HasValue || currentUser.CompanyId.Value <= 0)
            return ApiResponse<CallRecordDto>.FailureResult("Unauthorized: Company ID is missing.");

        int? validLeadId = request.LeadId;
        if (validLeadId.HasValue)
        {
            if (validLeadId.Value <= 0)
            {
                validLeadId = null;
            }
            else if (!context.Database.IsInMemory())
            {
                var leadExists = await context.Set<Lead>().AnyAsync(l => l.Id == validLeadId.Value, cancellationToken);
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
                var customerExists = await context.Set<Customer>().AnyAsync(c => c.Id == validCustomerId.Value, cancellationToken);
                if (!customerExists) validCustomerId = null;
            }
        }

        var record = new CallRecord { CompanyId = currentUser.CompanyId.Value, AgentId = currentUser.UserId.Value, ContactName = request.ContactName, ContactPhone = request.ContactPhone, Direction = request.Direction.ToLowerInvariant(), Duration = request.Duration, Disposition = request.Disposition, Notes = request.Notes, Reason = request.Reason, CallModule = request.Module, LeadId = validLeadId, CustomerId = validCustomerId };
        context.Set<CallRecord>().Add(record); await context.SaveChangesAsync(cancellationToken);
        return ApiResponse<CallRecordDto>.SuccessResult(Map(record), "Call logged");
    }

    public async Task<ApiResponse<CallRecordDto>> ProcessDispositionAsync(CallDispositionDto request, CancellationToken cancellationToken)
    {
        if (!currentUser.UserId.HasValue || currentUser.UserId.Value <= 0)
            return ApiResponse<CallRecordDto>.FailureResult("Unauthorized: User ID is missing.");
        if (!currentUser.CompanyId.HasValue || currentUser.CompanyId.Value <= 0)
            return ApiResponse<CallRecordDto>.FailureResult("Unauthorized: Company ID is missing.");

        int? validLeadId = request.LeadId;
        if (validLeadId.HasValue)
        {
            if (validLeadId.Value <= 0)
            {
                validLeadId = null;
            }
            else if (!context.Database.IsInMemory())
            {
                var leadExists = await context.Set<Lead>().AnyAsync(l => l.Id == validLeadId.Value, cancellationToken);
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
                var customerExists = await context.Set<Customer>().AnyAsync(c => c.Id == validCustomerId.Value, cancellationToken);
                if (!customerExists) validCustomerId = null;
            }
        }

        CallRecord? record = request.CallId.HasValue ? await context.Set<CallRecord>().FirstOrDefaultAsync(x => x.Id == request.CallId && x.CompanyId == currentUser.CompanyId.Value && x.AgentId == currentUser.UserId.Value, cancellationToken) : null;
        if (record == null)
        {
            record = new CallRecord { CompanyId = currentUser.CompanyId.Value, AgentId = currentUser.UserId.Value, ContactName = request.ContactName, ContactPhone = request.ContactPhone, Direction = request.Direction.ToLowerInvariant(), Duration = request.Duration, LeadId = validLeadId, CustomerId = validCustomerId };
            context.Set<CallRecord>().Add(record);
        }
        record.Disposition = request.Disposition; 
        record.Notes = request.Notes;
        if (!string.IsNullOrWhiteSpace(request.Reason)) record.Reason = request.Reason;
        if (!string.IsNullOrWhiteSpace(request.Module)) record.CallModule = request.Module;
        Followup? newFollowup = null;
        if (request.LeadId.HasValue)
        {
            var lead = await context.Set<Lead>().FirstOrDefaultAsync(x => x.Id == request.LeadId && x.CompanyId == currentUser.CompanyId.Value, cancellationToken);
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
                        // Qualified lead: remove its open sales follow-ups (lead stays in leads) (same SaveChanges).
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

                    // Reclassified to Other: complete pending follow-ups so they leave the Follow-ups page
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
            }
            if (lead != null && request.Disposition is "Follow-up Required" or "Follow Up Required" or "Call Back" or "No Response") 
            {
                var agentUser = await context.Set<User>().Include(u => u.Role).FirstOrDefaultAsync(u => u.Id == currentUser.UserId.Value, cancellationToken);
                newFollowup = new Followup { 
                    CompanyId = currentUser.CompanyId.Value, 
                    AssignedAgentId = currentUser.UserId.Value, 
                    AssignedToName = agentUser?.Name ?? string.Empty,
                    AssignedToRole = agentUser?.Role?.Code ?? "sales_executive",
                    LeadId = lead.Id, 
                    ContactId = lead.Id.ToString(), 
                    ContactType = "lead", 
                    ContactName = lead.Name, 
                    ContactPhone = lead.Phone, 
                    ContactEmail = lead.Email,
                    ScheduledAt = request.FollowupAt ?? DateTime.UtcNow.AddDays(1), 
                    Notes = request.Notes ?? string.Empty,
                    HandoverId = lead.HandoverId,
                    OriginalOwnerId = lead.OriginalOwnerId
                };
                context.Set<Followup>().Add(newFollowup);
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
