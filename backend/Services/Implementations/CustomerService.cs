using System.Text.Json;
using backend.Authentication.Interfaces;
using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.Customers;
using backend.DTOs.Followups;
using backend.Helpers;
using backend.Models.Entities;
using backend.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Implementations;

public class CustomerService : ICustomerService
{
    private readonly ApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public CustomerService(ApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    private IQueryable<Customer> GetScopedCustomersQuery()
    {
        var role = _currentUser.Role;
        var agentId = _currentUser.UserId;
        var companyId = _currentUser.CompanyId;

        var query = _context.Customers.AsNoTracking()
            .Include(c => c.AssignedAgent)
            .Include(c => c.OriginalOwner)
            .Include(c => c.Handover)
            .AsQueryable();

        if (role == "super_admin")
        {
            if (companyId.HasValue)
                query = query.Where(c => c.CompanyId == companyId.Value);
            return query;
        }

        if (companyId.HasValue)
        {
            query = query.Where(c => c.CompanyId == companyId.Value);
        }

        if ((role == "sales_executive" || role == "irm") && agentId.HasValue)
        {
            query = query.Where(c => c.AssignedAgentId == agentId.Value);
        }

        return query;
    }

    private async Task<Customer?> FindScopedCustomerAsync(int id, CancellationToken ct)
    {
        var role = _currentUser.Role;
        var agentId = _currentUser.UserId;
        var companyId = _currentUser.CompanyId;

        var query = _context.Customers
            .Include(c => c.AssignedAgent)
            .Include(c => c.OriginalOwner)
            .Include(c => c.Handover)
            .Where(c => c.Id == id);

        if (role == "super_admin")
        {
            return await query.FirstOrDefaultAsync(ct);
        }

        if (companyId.HasValue)
        {
            query = query.Where(c => c.CompanyId == companyId.Value);
        }

        if ((role == "sales_executive" || role == "irm") && agentId.HasValue)
        {
            query = query.Where(c => c.AssignedAgentId == agentId.Value);
        }

        return await query.FirstOrDefaultAsync(ct);
    }

    public async Task<ApiResponse<PagedResult<CustomerResponseDto>>> GetCustomersAsync(string? status, string? search, int page = 1, int pageSize = 10, CancellationToken ct = default)
    {
        var query = GetScopedCustomersQuery();

        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(c => c.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(c =>
                c.Name.ToLower().Contains(s) ||
                c.Phone.Contains(s) ||
                c.Email.ToLower().Contains(s) ||
                c.Location.ToLower().Contains(s));
        }

        var totalCount = await query.CountAsync(ct);

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var entities = await query
            .OrderByDescending(c => c.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var items = entities.Select(MapToDto).ToList();

        return ApiResponse<PagedResult<CustomerResponseDto>>.SuccessResult(
            PagedResult<CustomerResponseDto>.Create(items, totalCount, page, pageSize),
            "Customers retrieved successfully.");
    }

    public async Task<ApiResponse<Customer360Dto>> GetCustomer360ByIdAsync(int id, CancellationToken ct = default)
    {
        var customer = await FindScopedCustomerAsync(id, ct);
        if (customer == null)
            return ApiResponse<Customer360Dto>.FailureResult("Customer not found or access denied.");

        var customerIdStr = customer.Id.ToString();

        // 1. Fetch related calls from CallRecords with Agent and Role for caller details
        var rawCalls = await _context.CallRecords
            .AsNoTracking()
            .Include(cr => cr.Agent)
                .ThenInclude(a => a!.Role)
            .Where(cr => cr.CompanyId == customer.CompanyId &&
                         (cr.CustomerId == customer.Id || cr.ContactPhone == customer.Phone))
            .OrderByDescending(cr => cr.Timestamp)
            .ToListAsync(ct);

        var seenSids = new HashSet<string>();
        var seenIds = new HashSet<int>();
        var callRecords = new List<Customer360CallSummaryDto>();

        foreach (var cr in rawCalls)
        {
            if (!string.IsNullOrWhiteSpace(cr.TwilioCallSid))
            {
                if (seenSids.Contains(cr.TwilioCallSid)) continue;
                seenSids.Add(cr.TwilioCallSid);
            }
            if (seenIds.Contains(cr.Id)) continue;
            seenIds.Add(cr.Id);

            var callerRoleCode = cr.Agent?.Role?.Code?.ToLowerInvariant();
            var isIrm = callerRoleCode == "irm" ||
                        (cr.CallModule != null && cr.CallModule.Contains("irm", StringComparison.OrdinalIgnoreCase)) ||
                        (cr.Notes != null && cr.Notes.Contains("[Source: irm]", StringComparison.OrdinalIgnoreCase));
            var callerRole = isIrm ? "IRM" : "Sales Executive";
            var statusAtCall = cr.LeadStatusAtCall;
            if (string.IsNullOrWhiteSpace(statusAtCall))
            {
                statusAtCall = !string.IsNullOrWhiteSpace(cr.Disposition) ? cr.Disposition : customer.Status;
            }

            callRecords.Add(new Customer360CallSummaryDto
            {
                Id = cr.Id,
                Direction = cr.Direction,
                Duration = cr.Duration,
                Disposition = cr.Disposition,
                Notes = cr.Notes ?? string.Empty,
                Timestamp = cr.Timestamp,
                CallerName = cr.Agent?.Name ?? "Sales Executive",
                CallerRole = callerRole,
                LeadStatusAtCall = statusAtCall,
                TwilioCallSid = cr.TwilioCallSid
            });
        }

        // 2. Fetch associated follow-ups
        var followups = await _context.Followups
            .AsNoTracking()
            .Include(f => f.AssignedAgent)
            .Where(f => f.CompanyId == customer.CompanyId &&
                         ((f.ContactId == customerIdStr && f.ContactType == "customer") || f.ContactPhone == customer.Phone))
            .OrderByDescending(f => f.ScheduledAt)
            .Take(50)
            .Select(f => new FollowupResponseDto
            {
                Id = f.Id,
                CompanyId = f.CompanyId,
                AssignedAgentId = f.AssignedAgentId,
                AssignedAgentName = f.AssignedAgent != null ? f.AssignedAgent.Name : null,
                ContactId = f.ContactId,
                ContactType = f.ContactType,
                ContactName = f.ContactName,
                ContactPhone = f.ContactPhone,
                ScheduledAt = f.ScheduledAt,
                Priority = f.Priority,
                Status = f.Status.ToString(),
                Notes = f.Notes,
                CompletedAt = f.CompletedAt,
                CreatedAt = f.CreatedAt,
                UpdatedAt = f.UpdatedAt
            })
            .ToListAsync(ct);

        var result = new Customer360Dto
        {
            Customer = MapToDto(customer),
            Calls = callRecords,
            Followups = followups
        };

        return ApiResponse<Customer360Dto>.SuccessResult(result, "Customer 360 profile loaded successfully.");
    }

    public async Task<ApiResponse<CustomerResponseDto>> CreateCustomerAsync(CreateCustomerDto dto, CancellationToken ct = default)
    {
        var agentId = _currentUser.UserId;
        if (!agentId.HasValue || agentId.Value <= 0)
            return ApiResponse<CustomerResponseDto>.FailureResult("Unauthorized: User ID is missing.");

        var companyId = _currentUser.CompanyId;
        if (!companyId.HasValue || companyId.Value <= 0)
            return ApiResponse<CustomerResponseDto>.FailureResult("Unauthorized: Company ID is missing.");

        // Tenant-scoped normalized duplicate check across customers AND leads
        var normPhone = ContactNormalizer.NormalizePhone(dto.Phone);
        var normEmail = ContactNormalizer.NormalizeEmail(dto.Email);

        if (normPhone != null || normEmail != null)
        {
            var existingCust = await _context.Customers
                .Include(c => c.AssignedAgent)
                .FirstOrDefaultAsync(c =>
                    c.CompanyId == companyId.Value &&
                    !c.IsDuplicate &&
                    ((normPhone != null && c.NormalizedPhone == normPhone) ||
                     (normEmail != null && c.NormalizedEmail == normEmail)), ct);

            if (existingCust != null)
            {
                var assignedTo = existingCust.AssignedAgent?.Name ?? "another agent";
                return ApiResponse<CustomerResponseDto>.FailureResult(
                    $"A customer already exists with this contact information: {existingCust.Name} ({existingCust.Phone} / {existingCust.Email}), assigned to {assignedTo}.",
                    new List<string> { "DUPLICATE_CUSTOMER", $"CONTACT_ID:{existingCust.Id}" });
            }

            var existingLead = await _context.Leads
                .Include(l => l.AssignedAgent)
                .FirstOrDefaultAsync(l =>
                    l.CompanyId == companyId.Value &&
                    !l.IsDuplicate &&
                    ((normPhone != null && l.NormalizedPhone == normPhone) ||
                     (normEmail != null && l.NormalizedEmail == normEmail)), ct);

            if (existingLead != null)
            {
                var assignedTo = existingLead.AssignedAgent?.Name ?? "another agent";
                return ApiResponse<CustomerResponseDto>.FailureResult(
                    $"A lead already exists with this contact information: {existingLead.Name} ({existingLead.Phone} / {existingLead.Email}), assigned to {assignedTo}.",
                    new List<string> { "DUPLICATE_LEAD", $"CONTACT_ID:{existingLead.Id}" });
            }
        }

        var customer = new Customer
        {
            CompanyId = companyId.Value,
            AssignedAgentId = agentId.Value,
            Name = dto.Name.Trim(),
            Phone = dto.Phone.Trim(),
            Email = dto.Email?.Trim() ?? string.Empty,
            NormalizedPhone = normPhone,
            NormalizedEmail = normEmail,
            IsDuplicate = false,
            Location = dto.Location?.Trim() ?? string.Empty,
            Status = string.IsNullOrWhiteSpace(dto.Status) ? "Active" : dto.Status.Trim(),
            TotalValue = dto.TotalValue ?? 0,
            Notes = dto.Notes?.Trim() ?? string.Empty,
            CustomFieldsJson = dto.CustomFields != null && dto.CustomFields.Count > 0 ? JsonSerializer.Serialize(dto.CustomFields) : null,
            CreatedAt = DateTime.UtcNow
        };

        _context.Customers.Add(customer);
        await _context.SaveChangesAsync(ct);

        await _context.Entry(customer).Reference(c => c.AssignedAgent).LoadAsync(ct);

        return ApiResponse<CustomerResponseDto>.SuccessResult(MapToDto(customer), "Customer created successfully.");
    }

    public async Task<ApiResponse<CustomerResponseDto>> UpdateCustomerAsync(int id, UpdateCustomerDto dto, CancellationToken ct = default)
    {
        var customer = await FindScopedCustomerAsync(id, ct);
        if (customer == null)
            return ApiResponse<CustomerResponseDto>.FailureResult("Customer not found or access denied.");

        if (dto.Phone != null || dto.Email != null)
        {
            var candidatePhone = dto.Phone != null ? dto.Phone.Trim() : customer.Phone;
            var candidateEmail = dto.Email != null ? dto.Email.Trim() : customer.Email;
            var newNormPhone = ContactNormalizer.NormalizePhone(candidatePhone);
            var newNormEmail = ContactNormalizer.NormalizeEmail(candidateEmail);

            if (newNormPhone != null || newNormEmail != null)
            {
                var existingOtherCust = await _context.Customers
                    .Include(c => c.AssignedAgent)
                    .FirstOrDefaultAsync(c =>
                        c.CompanyId == customer.CompanyId &&
                        c.Id != customer.Id &&
                        !c.IsDuplicate &&
                        ((newNormPhone != null && c.NormalizedPhone == newNormPhone) ||
                         (newNormEmail != null && c.NormalizedEmail == newNormEmail)), ct);

                if (existingOtherCust != null)
                {
                    return ApiResponse<CustomerResponseDto>.FailureResult(
                        $"Cannot update customer: Another customer already exists with this contact information: {existingOtherCust.Name} ({existingOtherCust.Phone} / {existingOtherCust.Email}).");
                }

                var existingLead = await _context.Leads
                    .Include(l => l.AssignedAgent)
                    .FirstOrDefaultAsync(l =>
                        l.CompanyId == customer.CompanyId &&
                        !l.IsDuplicate &&
                        ((newNormPhone != null && l.NormalizedPhone == newNormPhone) ||
                         (newNormEmail != null && l.NormalizedEmail == newNormEmail)), ct);

                if (existingLead != null)
                {
                    return ApiResponse<CustomerResponseDto>.FailureResult(
                        $"Cannot update customer: A lead already exists with this contact information: {existingLead.Name} ({existingLead.Phone} / {existingLead.Email}).");
                }
            }

            if (dto.Phone != null) customer.Phone = dto.Phone.Trim();
            if (dto.Email != null) customer.Email = dto.Email.Trim();
            customer.NormalizedPhone = newNormPhone;
            customer.NormalizedEmail = newNormEmail;
        }

        if (dto.Name != null) customer.Name = dto.Name.Trim();
        if (dto.Location != null) customer.Location = dto.Location.Trim();
        if (dto.Status != null) customer.Status = dto.Status.Trim();
        if (dto.TotalValue.HasValue) customer.TotalValue = dto.TotalValue.Value;
        if (dto.Notes != null) customer.Notes = dto.Notes.Trim();

        if (dto.CustomFields != null)
        {
            var existingFields = DeserializeCustomFields(customer.CustomFieldsJson);
            foreach (var kvp in dto.CustomFields)
            {
                existingFields[kvp.Key] = kvp.Value;
            }
            customer.CustomFieldsJson = existingFields.Count > 0 ? JsonSerializer.Serialize(existingFields) : null;
        }

        customer.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(ct);

        return ApiResponse<CustomerResponseDto>.SuccessResult(MapToDto(customer), "Customer updated successfully.");
    }

    private static CustomerResponseDto MapToDto(Customer c)
    {
        var customFields = DeserializeCustomFields(c.CustomFieldsJson);
        bool isReturned = customFields.TryGetValue("returnedFromHandover", out var retVal) && retVal == "true";
        string? returnedCoveringName = customFields.TryGetValue("returnedFromCoveringUserName", out var rcn) ? rcn : null;
        DateTime? returnedAt = null;
        if (customFields.TryGetValue("returnedAt", out var retAtStr) && DateTime.TryParse(retAtStr, out var parsedRetAt))
        {
            returnedAt = parsedRetAt;
        }

        return new CustomerResponseDto
        {
            Id = c.Id,
            CompanyId = c.CompanyId,
            AssignedAgentId = c.AssignedAgentId ?? 0,
            AssignedAgentName = c.AssignedAgent?.Name,
            Name = c.Name,
            Phone = c.Phone,
            Email = c.Email,
            Location = c.Location,
            Status = c.Status,
            TotalValue = c.TotalValue,
            Notes = c.Notes,
            CustomFields = customFields,
            LastContactedAt = c.LastContactedAt,
            CreatedAt = c.CreatedAt,
            UpdatedAt = c.UpdatedAt,
            HandoverId = c.HandoverId,
            HandedOverFromName = c.OriginalOwner?.Name,
            HandoverPlannedEnd = c.Handover?.PlannedEndAt,
            OriginalOwnerId = c.OriginalOwnerId,
            IsReturnedFromHandover = isReturned,
            ReturnedFromCoveringUserName = returnedCoveringName,
            ReturnedAt = returnedAt
        };
    }

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
