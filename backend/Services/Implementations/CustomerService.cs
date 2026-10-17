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

    private IQueryable<Customer> GetScopedCustomersQuery(string? tenantId = null)
    {
        var role = _currentUser.Role;
        var agentId = _currentUser.UserId;
        var companyId = _currentUser.CompanyId;

        if (!string.IsNullOrWhiteSpace(tenantId))
        {
            var t = tenantId.Trim().ToLowerInvariant();
            int? requestedCompanyId = null;
            if (t == "ghl" || t == "1" || t == "t-ghl-01") requestedCompanyId = 1;
            else if (t == "jamin" || t == "2" || t == "t-jamin-02") requestedCompanyId = 2;
            else if (int.TryParse(t, out var parsed)) requestedCompanyId = parsed;

            // Only super admins may switch tenant through a query parameter.
            // Other roles remain scoped to the company in their authenticated claims.
            if (role == "super_admin")
                companyId = requestedCompanyId ?? companyId;
        }

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
            // Sales Executives see their own assigned customers and available (unassigned) customers
            query = query.Where(c => c.AssignedAgentId == agentId.Value || c.AssignedAgentId == null);
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
            query = query.Where(c => c.AssignedAgentId == agentId.Value || c.AssignedAgentId == null);
        }

        return await query.FirstOrDefaultAsync(ct);
    }

    public async Task<ApiResponse<PagedResult<CustomerResponseDto>>> GetCustomersAsync(string? status, string? search, int page = 1, int pageSize = 10, string? tenantId = null, CancellationToken ct = default)
    {
        var query = GetScopedCustomersQuery(tenantId);

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

        // Resolve all historical Lead IDs linked to this Customer strictly by booking primary key associations
        var linkedLeadIds = await _context.JaminBookings
            .Where(b => b.CustomerId == customer.Id && b.LeadId.HasValue)
            .Select(b => b.LeadId!.Value)
            .Distinct()
            .ToListAsync(ct);

        // 1. Fetch related calls from CallRecords connecting strictly by primary keys (CustomerId or linked LeadId)
        var callRecords = await _context.CallRecords
            .AsNoTracking()
            .Include(cr => cr.Agent)
            .Where(cr => cr.CustomerId == customer.Id ||
                         (cr.LeadId.HasValue && linkedLeadIds.Contains(cr.LeadId.Value)))
            .OrderByDescending(cr => cr.Timestamp)
            .Take(100)
            .Select(cr => new Customer360CallSummaryDto
            {
                Id = cr.Id,
                AgentId = cr.AgentId,
                AgentName = cr.Agent != null ? cr.Agent.Name : null,
                ContactName = cr.ContactName,
                ContactPhone = cr.ContactPhone,
                Direction = cr.Direction,
                Duration = cr.Duration,
                Disposition = cr.Disposition,
                Notes = cr.Notes ?? string.Empty,
                LeadId = cr.LeadId,
                CustomerId = cr.CustomerId,
                Timestamp = cr.Timestamp
            })
            .ToListAsync(ct);

        // 2. Fetch associated follow-ups strictly by primary keys (CustomerId, linked LeadId, or ContactId)
        var followups = await _context.Followups
            .AsNoTracking()
            .Include(f => f.AssignedAgent)
            .Where(f => f.CompanyId == customer.CompanyId &&
                         (f.CustomerId == customer.Id || (f.LeadId.HasValue && linkedLeadIds.Contains(f.LeadId.Value)) || (f.ContactId == customerIdStr && f.ContactType == "customer")))
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
                LeadId = f.LeadId,
                CustomerId = f.CustomerId,
                InvestorId = f.InvestorId,
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

        // 3. Fetch associated site visits strictly by primary keys (CustomerId or linked LeadId)
        var siteVisits = await _context.SiteVisits
            .AsNoTracking()
            .Where(sv => (sv.TenantId == customer.CompanyId || sv.TenantId == 2) && 
                         (sv.CustomerId == customer.Id || (sv.LeadId.HasValue && linkedLeadIds.Contains(sv.LeadId.Value))))
            .OrderByDescending(sv => sv.CreatedAt)
            .Take(50)
            .Select(sv => new backend.DTOs.Jamin.JaminSiteVisitDto
            {
                Id = sv.Id,
                TenantId = sv.TenantId,
                LeadId = sv.LeadId,
                CustomerId = sv.CustomerId,
                ProjectId = sv.ProjectId,
                PlotId = sv.PlotId,
                CustomerName = sv.CustomerName,
                CustomerPhone = sv.CustomerPhone,
                ContactType = sv.ContactType,
                ProjectName = sv.ProjectName,
                PlotNumber = sv.PlotNumber,
                ScheduledAt = sv.ScheduledAt,
                AssignedAgentId = sv.AssignedAgentId,
                AssignedAgentName = sv.AssignedAgentName,
                Status = sv.Status,
                VisitorNote = sv.VisitorNote,
                OutcomeNotes = sv.OutcomeNotes,
                CreatedAt = sv.CreatedAt
            })
            .ToListAsync(ct);

        // 4. Fetch associated bookings with payment ledger strictly by primary keys (CustomerId or linked LeadId)
        var bookingEntities = await _context.JaminBookings
            .AsNoTracking()
            .Include(b => b.Payments)
            .Where(b => (b.CompanyId == customer.CompanyId || b.CompanyId == 2) && 
                         (b.CustomerId == customer.Id || (b.LeadId.HasValue && linkedLeadIds.Contains(b.LeadId.Value))))
            .OrderByDescending(b => b.BookingDate)
            .Take(50)
            .ToListAsync(ct);

        var bookings = bookingEntities.Select(b =>
        {
            var payments = b.Payments.Select(p => new backend.DTOs.Jamin.JaminPaymentResponseDto
            {
                Id = p.Id,
                CompanyId = p.CompanyId,
                BookingId = p.BookingId,
                CustomerId = p.CustomerId,
                LeadId = p.LeadId,
                Amount = p.Amount,
                PaymentType = p.PaymentType,
                PaymentMode = p.PaymentMode,
                TransactionReference = p.TransactionReference,
                Status = p.Status,
                VerifiedAt = p.VerifiedAt,
                VerifiedByUserId = p.VerifiedByUserId,
                VerifiedByName = p.VerifiedByName,
                ReceiptNumber = p.ReceiptNumber,
                Notes = p.Notes,
                CreatedAt = p.CreatedAt
            }).ToList();

            var verifiedReceipts = payments.Where(p => p.Status == "Verified" && p.PaymentType != "Refund").Sum(p => p.Amount);
            if (verifiedReceipts == 0 && (b.Status == "Token Paid" || b.PaymentStatus == "Verified") && b.TokenAmountPaid > 0)
            {
                verifiedReceipts = b.TokenAmountPaid;
            }
            var totalRefunds = payments.Where(p => p.Status == "Verified" && p.PaymentType == "Refund").Sum(p => p.Amount) + b.RefundAmount;
            var netCashReceived = Math.Max(0, verifiedReceipts - totalRefunds);
            var contractValue = b.TotalPlotPrice;
            var contractBalance = (b.Status is "Cancelled" or "Voided") ? 0 : Math.Max(0, contractValue - netCashReceived);

            return new backend.DTOs.Jamin.JaminBookingResponseDto
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
                BasePrice = b.BasePrice > 0 ? b.BasePrice : b.TotalPlotPrice,
                DevelopmentCharges = b.DevelopmentCharges,
                ApprovedDiscounts = b.ApprovedDiscounts,
                TotalPlotPrice = b.TotalPlotPrice,
                TokenAmountPaid = b.TokenAmountPaid,
                PaymentMode = b.PaymentMode,
                PaymentTerms = b.PaymentTerms,
                Status = b.Status,
                PaymentStatus = b.PaymentStatus,
                HoldExpiresAt = b.HoldExpiresAt,
                BookingDate = b.BookingDate,
                AssignedAgentId = b.AssignedAgentId,
                AssignedAgentName = b.AssignedAgentName,
                CancelledAt = b.CancelledAt,
                CancelledByUserId = b.CancelledByUserId,
                CancelledByName = b.CancelledByName,
                CancellationReason = b.CancellationReason,
                RefundAmount = b.RefundAmount,
                Notes = b.Notes,
                CreatedAt = b.CreatedAt,
                UpdatedAt = b.UpdatedAt,
                Payments = payments,
                VerifiedReceipts = verifiedReceipts,
                TotalRefunds = totalRefunds,
                NetCashReceived = netCashReceived,
                ContractBalance = contractBalance
            };
        }).ToList();

        var result = new Customer360Dto
        {
            Customer = MapToDto(customer),
            Calls = callRecords,
            Followups = followups,
            SiteVisits = siteVisits,
            Bookings = bookings
        };

        return ApiResponse<Customer360Dto>.SuccessResult(result, "Customer 360 profile loaded successfully.");
    }

    public async Task<ApiResponse<CustomerResponseDto>> CreateCustomerAsync(CreateCustomerDto dto, CancellationToken ct = default)
    {
        var isSuperAdmin = string.Equals(_currentUser.Role, "super_admin", StringComparison.OrdinalIgnoreCase);
        var companyId = isSuperAdmin
            ? dto.CompanyId ?? _currentUser.CompanyId ?? 1
            : _currentUser.CompanyId ?? 1;
        var isSalesExecutive = string.Equals(_currentUser.Role, "sales_executive", StringComparison.OrdinalIgnoreCase);
        var agentId = isSalesExecutive
            ? _currentUser.UserId
            : dto.ClearAssignedAgent ? null : dto.AssignedAgentId ?? _currentUser.UserId;

        if (agentId.HasValue && !await _context.Users.AnyAsync(u => u.Id == agentId.Value && u.CompanyId == companyId, ct))
            return ApiResponse<CustomerResponseDto>.FailureResult("The selected executive does not belong to this company.");

        // Tenant-scoped normalized duplicate check across customers AND leads
        var normPhone = ContactNormalizer.NormalizePhone(dto.Phone);
        var normEmail = ContactNormalizer.NormalizeEmail(dto.Email);

        if (normPhone != null || normEmail != null)
        {
            var existingCust = await _context.Customers
                .Include(c => c.AssignedAgent)
                .FirstOrDefaultAsync(c =>
                    c.CompanyId == companyId &&
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
                    l.CompanyId == companyId &&
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
            CompanyId = companyId,
            AssignedAgentId = agentId,
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

        if (string.Equals(_currentUser.Role, "sales_executive", StringComparison.OrdinalIgnoreCase) &&
            ((dto.ClearAssignedAgent && customer.AssignedAgentId.HasValue) ||
             (dto.AssignedAgentId.HasValue && dto.AssignedAgentId != customer.AssignedAgentId)))
            return ApiResponse<CustomerResponseDto>.FailureResult("Sales executives cannot reassign customers.");

        if (dto.Phone != null || dto.Email != null)
        {
            var candidatePhone = dto.Phone != null ? dto.Phone.Trim() : customer.Phone;
            var candidateEmail = dto.Email != null ? dto.Email.Trim() : customer.Email;
            var newNormPhone = ContactNormalizer.NormalizePhone(candidatePhone);
            var newNormEmail = ContactNormalizer.NormalizeEmail(candidateEmail);

            var phoneChanged = newNormPhone != customer.NormalizedPhone;
            var emailChanged = newNormEmail != customer.NormalizedEmail;

            if ((phoneChanged || emailChanged) && (newNormPhone != null || newNormEmail != null))
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

        if (dto.ClearAssignedAgent)
        {
            customer.AssignedAgentId = null;
        }
        else if (dto.AssignedAgentId.HasValue)
        {
            var validAgent = await _context.Users.AnyAsync(
                u => u.Id == dto.AssignedAgentId.Value && u.CompanyId == customer.CompanyId, ct);
            if (!validAgent)
                return ApiResponse<CustomerResponseDto>.FailureResult("The selected executive does not belong to this company.");
            customer.AssignedAgentId = dto.AssignedAgentId.Value;
        }

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
        if (customer.AssignedAgentId.HasValue)
        {
            customer.AssignedAgent = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == customer.AssignedAgentId.Value, ct);
        }
        else
        {
            customer.AssignedAgent = null;
        }

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
            AssignedAgentId = c.AssignedAgentId,
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
