using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using backend.Authentication.Interfaces;
using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.Customers;
using backend.Helpers;
using backend.Models.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/converted-customers")]
[Authorize(Roles = "super_admin,company_admin,sales_executive,irm")]
public class ConvertedCustomersController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;

    public ConvertedCustomersController(ApplicationDbContext db, ICurrentUserService currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    /// <summary>
    /// Utility method to ensure all legitimately converted leads and deals have corresponding
    /// normalized records in the authoritative Customers table with real committed values.
    /// Prevents duplicate customer entries by checking normalized contacts.
    /// </summary>
    public static async Task SyncConvertedCustomersAsync(ApplicationDbContext db, CancellationToken ct = default)
    {
        try
        {
            var convertedLeads = await db.Leads
                .AsNoTracking()
                .Where(l => l.Status == "Converted")
                .ToListAsync(ct);

            var convertedDeals = await db.GhlDeals
                .AsNoTracking()
                .Where(d => d.Stage == "converted")
                .ToListAsync(ct);

            var existingCustomers = await db.Customers
                .ToListAsync(ct);

            bool hasChanges = false;

            // 1. Process converted deals with committed amounts
            foreach (var deal in convertedDeals)
            {
                var dealNormName = deal.CustomerName.Trim().ToLower();
                Customer? matchedCustomer = null;

                if (deal.CustomerId.HasValue && deal.CustomerId.Value > 0)
                {
                    matchedCustomer = existingCustomers.FirstOrDefault(c => c.Id == deal.CustomerId.Value);
                }

                if (matchedCustomer == null && !string.IsNullOrWhiteSpace(dealNormName))
                {
                    matchedCustomer = existingCustomers.FirstOrDefault(c =>
                        c.CompanyId == deal.CompanyId &&
                        c.Name.Trim().ToLower() == dealNormName);
                }

                // If no customer exists, check if there is a converted lead
                var matchingLead = convertedLeads.FirstOrDefault(l =>
                    l.CompanyId == deal.CompanyId &&
                    (l.Id == deal.CustomerId || l.Name.Trim().ToLower() == dealNormName));

                if (matchedCustomer == null && matchingLead != null)
                {
                    var normPhone = !string.IsNullOrWhiteSpace(matchingLead.NormalizedPhone)
                        ? matchingLead.NormalizedPhone
                        : ContactNormalizer.NormalizePhone(matchingLead.Phone);

                    var normEmail = !string.IsNullOrWhiteSpace(matchingLead.NormalizedEmail)
                        ? matchingLead.NormalizedEmail
                        : ContactNormalizer.NormalizeEmail(matchingLead.Email);

                    matchedCustomer = existingCustomers.FirstOrDefault(c =>
                        c.CompanyId == deal.CompanyId &&
                        ((normPhone != null && c.NormalizedPhone == normPhone) ||
                         (normEmail != null && c.NormalizedEmail == normEmail)));
                }

                if (matchedCustomer == null)
                {
                    // Create new authoritative Customer record from the converted deal / lead
                    var assignedAgentId = deal.AssignedAgentId > 0
                        ? deal.AssignedAgentId
                        : (matchingLead?.AssignedAgentId ?? 1);

                    var newCustomer = new Customer
                    {
                        CompanyId = deal.CompanyId,
                        AssignedAgentId = assignedAgentId,
                        Name = !string.IsNullOrWhiteSpace(deal.CustomerName) ? deal.CustomerName : (matchingLead?.Name ?? "Converted Customer"),
                        Phone = matchingLead?.Phone ?? string.Empty,
                        Email = matchingLead?.Email ?? string.Empty,
                        NormalizedPhone = matchingLead?.NormalizedPhone ?? ContactNormalizer.NormalizePhone(matchingLead?.Phone ?? ""),
                        NormalizedEmail = matchingLead?.NormalizedEmail ?? ContactNormalizer.NormalizeEmail(matchingLead?.Email ?? ""),
                        Location = matchingLead?.Location ?? string.Empty,
                        Status = "Active",
                        TotalValue = deal.Value > 0 ? deal.Value : 0m,
                        Notes = !string.IsNullOrWhiteSpace(deal.Notes) ? deal.Notes : (matchingLead?.Notes ?? string.Empty),
                        CustomFieldsJson = matchingLead?.CustomFieldsJson,
                        CreatedAt = deal.CreatedAt < DateTime.UtcNow.AddYears(-10) ? DateTime.UtcNow : deal.CreatedAt,
                        UpdatedAt = deal.UpdatedAt,
                        HandoverId = deal.HandoverId ?? matchingLead?.HandoverId,
                        OriginalOwnerId = deal.OriginalOwnerId ?? matchingLead?.OriginalOwnerId,
                        IsDuplicate = false
                    };

                    db.Customers.Add(newCustomer);
                    existingCustomers.Add(newCustomer);
                    hasChanges = true;
                }
                else
                {
                    // Ensure committed amount is reflected
                    if (deal.Value > 0 && matchedCustomer.TotalValue < deal.Value)
                    {
                        matchedCustomer.TotalValue = deal.Value;
                        hasChanges = true;
                    }
                }
            }

            // 2. Process any remaining converted leads without deals
            foreach (var lead in convertedLeads)
            {
                var normPhone = !string.IsNullOrWhiteSpace(lead.NormalizedPhone)
                    ? lead.NormalizedPhone
                    : ContactNormalizer.NormalizePhone(lead.Phone);

                var normEmail = !string.IsNullOrWhiteSpace(lead.NormalizedEmail)
                    ? lead.NormalizedEmail
                    : ContactNormalizer.NormalizeEmail(lead.Email);

                var leadNormName = lead.Name.Trim().ToLower();

                var customerExists = existingCustomers.Any(c =>
                    c.CompanyId == lead.CompanyId &&
                    ((normPhone != null && c.NormalizedPhone == normPhone) ||
                     (normEmail != null && c.NormalizedEmail == normEmail) ||
                     c.Name.Trim().ToLower() == leadNormName));

                if (!customerExists)
                {
                    var newCustomer = new Customer
                    {
                        CompanyId = lead.CompanyId,
                        AssignedAgentId = lead.AssignedAgentId ?? 1,
                        Name = lead.Name,
                        Phone = lead.Phone,
                        Email = lead.Email,
                        NormalizedPhone = normPhone,
                        NormalizedEmail = normEmail,
                        Location = lead.Location,
                        Status = "Active",
                        TotalValue = 0m,
                        Notes = lead.Notes,
                        CustomFieldsJson = lead.CustomFieldsJson,
                        CreatedAt = lead.CreatedAt,
                        UpdatedAt = lead.UpdatedAt,
                        HandoverId = lead.HandoverId,
                        OriginalOwnerId = lead.OriginalOwnerId,
                        IsDuplicate = false
                    };

                    db.Customers.Add(newCustomer);
                    existingCustomers.Add(newCustomer);
                    hasChanges = true;
                }
            }

            if (hasChanges)
            {
                await db.SaveChangesAsync(ct);
            }
        }
        catch
        {
            // Transient sync failure should not break live requests
        }
    }

    /// <summary>
    /// GET /api/converted-customers
    /// Dedicated endpoint returning the complete list of legitimately converted customers
    /// with summary metrics, server-side filtering, sorting, and pagination.
    /// Strictly adheres to multi-tenant isolation and user permissions.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<ConvertedCustomerListResponseDto>>> GetConvertedCustomers(
        [FromQuery] ConvertedCustomerQueryParams queryParams,
        CancellationToken ct = default)
    {
        // 1. Ensure synchronisation of legitimate conversions
        await SyncConvertedCustomersAsync(_db, ct);

        var role = _currentUser.Role;
        var userCompanyId = _currentUser.CompanyId;
        var userId = _currentUser.UserId;

        // 2. Base Query with relations
        var query = _db.Customers
            .AsNoTracking()
            .Include(c => c.Company)
            .Include(c => c.AssignedAgent)
                .ThenInclude(a => a!.Role)
            .Where(c => !c.IsDuplicate)
            .AsQueryable();

        // 3. Strict Tenant Isolation and Role Scoping
        if (role == "super_admin")
        {
            if (queryParams.TenantId.HasValue && queryParams.TenantId.Value > 0)
            {
                query = query.Where(c => c.CompanyId == queryParams.TenantId.Value);
            }
        }
        else if (role == "company_admin")
        {
            if (!userCompanyId.HasValue)
                return Forbid();

            query = query.Where(c => c.CompanyId == userCompanyId.Value);
        }
        else if (role == "sales_executive" || role == "irm")
        {
            if (!userCompanyId.HasValue || !userId.HasValue)
                return Forbid();

            query = query.Where(c => c.CompanyId == userCompanyId.Value && c.AssignedAgentId == userId.Value);
        }
        else
        {
            return Forbid();
        }

        // 4. Status Filter
        if (!string.IsNullOrWhiteSpace(queryParams.Status) && !queryParams.Status.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            var st = queryParams.Status.Trim().ToLower();
            query = query.Where(c => c.Status.ToLower() == st);
        }

        // 5. Assigned Agent Filter (for Super Admin & Company Admin)
        if (queryParams.AgentId.HasValue && queryParams.AgentId.Value > 0)
        {
            query = query.Where(c => c.AssignedAgentId == queryParams.AgentId.Value);
        }

        // 6. Conversion Date Range Filter
        if (queryParams.StartDate.HasValue)
        {
            var startUtc = DateTime.SpecifyKind(queryParams.StartDate.Value, DateTimeKind.Utc);
            query = query.Where(c => c.CreatedAt >= startUtc);
        }

        if (queryParams.EndDate.HasValue)
        {
            var endUtc = DateTime.SpecifyKind(queryParams.EndDate.Value, DateTimeKind.Utc);
            query = query.Where(c => c.CreatedAt <= endUtc);
        }

        // 7. Search Filter (Customer name, ID, code, phone, email)
        if (!string.IsNullOrWhiteSpace(queryParams.Search))
        {
            var s = queryParams.Search.Trim().ToLower();
            var isNumericId = int.TryParse(s.Replace("cust-", "").Replace("c-", "").Trim(), out var parsedId);

            query = query.Where(c =>
                c.Name.ToLower().Contains(s) ||
                c.Phone.Contains(s) ||
                c.Email.ToLower().Contains(s) ||
                (isNumericId && c.Id == parsedId));
        }

        // 8. Compute Summary Metrics across the ENTIRE scoped & filtered dataset BEFORE pagination
        var filteredEntities = await query.ToListAsync(ct);

        var totalConvertedCustomers = filteredEntities.Count;
        var totalCommittedAmount = filteredEntities.Sum(c => c.TotalValue);
        var averageCommittedValue = totalConvertedCustomers > 0
            ? Math.Round(totalCommittedAmount / totalConvertedCustomers, 2)
            : 0m;

        var nowUtc = DateTime.UtcNow;
        var currentMonthStart = new DateTime(nowUtc.Year, nowUtc.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var nextMonthStart = currentMonthStart.AddMonths(1);
        var convertedThisMonth = filteredEntities.Count(c => c.CreatedAt >= currentMonthStart && c.CreatedAt < nextMonthStart);

        var summary = new ConvertedCustomerSummaryDto
        {
            TotalConvertedCustomers = totalConvertedCustomers,
            TotalCommittedAmount = totalCommittedAmount,
            AverageCommittedValue = averageCommittedValue,
            ConvertedThisMonth = convertedThisMonth
        };

        // 9. Sorting
        var sortBy = (queryParams.SortBy ?? "conversionDate").Trim().ToLower();
        var isAsc = string.Equals(queryParams.SortOrder, "asc", StringComparison.OrdinalIgnoreCase);

        IEnumerable<Customer> sorted = sortBy switch
        {
            "name" => isAsc ? filteredEntities.OrderBy(c => c.Name) : filteredEntities.OrderByDescending(c => c.Name),
            "committedamount" => isAsc ? filteredEntities.OrderBy(c => c.TotalValue) : filteredEntities.OrderByDescending(c => c.TotalValue),
            "status" => isAsc ? filteredEntities.OrderBy(c => c.Status) : filteredEntities.OrderByDescending(c => c.Status),
            _ => isAsc ? filteredEntities.OrderBy(c => c.CreatedAt) : filteredEntities.OrderByDescending(c => c.CreatedAt)
        };

        // 10. Server-Side Pagination
        var page = Math.Max(1, queryParams.Page);
        var pageSize = Math.Clamp(queryParams.PageSize, 1, 100);
        var totalPages = totalConvertedCustomers > 0 ? (int)Math.Ceiling((double)totalConvertedCustomers / pageSize) : 1;

        var pagedCustomers = sorted
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        // 11. Enrich with original Lead and related GhlDeal context
        var customerIds = pagedCustomers.Select(c => c.Id).ToList();
        var customerPhones = pagedCustomers.Select(c => c.Phone).Where(p => !string.IsNullOrWhiteSpace(p)).ToList();
        var customerEmails = pagedCustomers.Select(c => c.Email).Where(e => !string.IsNullOrWhiteSpace(e)).ToList();
        var customerNames = pagedCustomers.Select(c => c.Name.Trim().ToLower()).ToList();

        var relatedDeals = await _db.GhlDeals
            .AsNoTracking()
            .Where(d => (d.CustomerId.HasValue && customerIds.Contains(d.CustomerId.Value)) ||
                        customerNames.Contains(d.CustomerName.Trim().ToLower()))
            .ToListAsync(ct);

        var relatedLeads = await _db.Leads
            .AsNoTracking()
            .Where(l => customerPhones.Contains(l.Phone) ||
                        customerEmails.Contains(l.Email) ||
                        customerNames.Contains(l.Name.Trim().ToLower()))
            .ToListAsync(ct);

        var items = pagedCustomers.Select(c =>
        {
            var custNameLower = c.Name.Trim().ToLower();

            var deal = relatedDeals.FirstOrDefault(d =>
                (d.CustomerId == c.Id) ||
                (d.CompanyId == c.CompanyId && d.CustomerName.Trim().ToLower() == custNameLower));

            var lead = relatedLeads.FirstOrDefault(l =>
                l.CompanyId == c.CompanyId &&
                ((!string.IsNullOrWhiteSpace(c.Phone) && l.Phone == c.Phone) ||
                 (!string.IsNullOrWhiteSpace(c.Email) && l.Email == c.Email) ||
                 l.Name.Trim().ToLower() == custNameLower));

            var customFields = new Dictionary<string, string>();
            if (!string.IsNullOrWhiteSpace(c.CustomFieldsJson))
            {
                try
                {
                    customFields = JsonSerializer.Deserialize<Dictionary<string, string>>(c.CustomFieldsJson) ?? new();
                }
                catch { }
            }

            var agentRole = c.AssignedAgent?.Role?.Name ?? "Sales Executive";

            // Committed amount is from Customer.TotalValue, with deal fallback if positive
            var committed = c.TotalValue > 0 ? c.TotalValue : (deal?.Value ?? 0m);

            return new ConvertedCustomerItemDto
            {
                Id = c.Id,
                CustomerCode = $"CUST-{c.Id:D4}",
                Name = c.Name,
                Email = c.Email,
                Phone = c.Phone,
                Location = c.Location,
                CompanyId = c.CompanyId,
                CompanyName = c.Company?.Name ?? "Platform Tenant",
                CompanySlug = c.Company?.Slug ?? "ghl",
                AssignedAgentId = c.AssignedAgentId,
                AssignedAgentName = c.AssignedAgent?.Name ?? "Unassigned",
                AssignedAgentRole = agentRole,
                OriginalLeadSource = lead?.Source ?? (deal != null ? "Direct Pipeline" : "Inbound Conversion"),
                RelatedLeadId = lead?.Id,
                RelatedDealId = deal?.Id,
                RelatedDealTitle = deal?.Title,
                CommittedAmount = committed,
                ConversionDate = c.CreatedAt,
                Status = string.IsNullOrWhiteSpace(c.Status) ? "Active" : c.Status,
                Notes = c.Notes,
                CustomFields = customFields,
                LastContactedAt = c.LastContactedAt,
                UpdatedAt = c.UpdatedAt
            };
        }).ToList();

        var response = new ConvertedCustomerListResponseDto
        {
            Summary = summary,
            Items = items,
            TotalCount = totalConvertedCustomers,
            Page = page,
            PageSize = pageSize,
            TotalPages = totalPages
        };

        return Ok(ApiResponse<ConvertedCustomerListResponseDto>.SuccessResult(response));
    }

    /// <summary>
    /// GET /api/converted-customers/{id}
    /// Retrieve single converted customer profile with rich lifecycle and financial data.
    /// </summary>
    [HttpGet("{id:int}")]
    public async Task<ActionResult<ApiResponse<ConvertedCustomerItemDto>>> GetConvertedCustomerById(
        int id,
        CancellationToken ct = default)
    {
        var role = _currentUser.Role;
        var userCompanyId = _currentUser.CompanyId;
        var userId = _currentUser.UserId;

        var query = _db.Customers
            .AsNoTracking()
            .Include(c => c.Company)
            .Include(c => c.AssignedAgent)
                .ThenInclude(a => a!.Role)
            .Where(c => c.Id == id);

        if (role != "super_admin")
        {
            if (!userCompanyId.HasValue) return Forbid();
            query = query.Where(c => c.CompanyId == userCompanyId.Value);

            if (role == "sales_executive" || role == "irm")
            {
                if (!userId.HasValue) return Forbid();
                query = query.Where(c => c.AssignedAgentId == userId.Value);
            }
        }

        var customer = await query.FirstOrDefaultAsync(ct);
        if (customer == null)
            return NotFound(ApiResponse<ConvertedCustomerItemDto>.FailureResult("Converted customer not found or access denied."));

        var custNameLower = customer.Name.Trim().ToLower();

        var deal = await _db.GhlDeals
            .AsNoTracking()
            .FirstOrDefaultAsync(d => (d.CustomerId == customer.Id) ||
                                      (d.CompanyId == customer.CompanyId && d.CustomerName.Trim().ToLower() == custNameLower), ct);

        var lead = await _db.Leads
            .AsNoTracking()
            .FirstOrDefaultAsync(l => l.CompanyId == customer.CompanyId &&
                                      ((!string.IsNullOrWhiteSpace(customer.Phone) && l.Phone == customer.Phone) ||
                                       (!string.IsNullOrWhiteSpace(customer.Email) && l.Email == customer.Email) ||
                                       l.Name.Trim().ToLower() == custNameLower), ct);

        var customFields = new Dictionary<string, string>();
        if (!string.IsNullOrWhiteSpace(customer.CustomFieldsJson))
        {
            try
            {
                customFields = JsonSerializer.Deserialize<Dictionary<string, string>>(customer.CustomFieldsJson) ?? new();
            }
            catch { }
        }

        var dto = new ConvertedCustomerItemDto
        {
            Id = customer.Id,
            CustomerCode = $"CUST-{customer.Id:D4}",
            Name = customer.Name,
            Email = customer.Email,
            Phone = customer.Phone,
            Location = customer.Location,
            CompanyId = customer.CompanyId,
            CompanyName = customer.Company?.Name ?? "Platform Tenant",
            CompanySlug = customer.Company?.Slug ?? "ghl",
            AssignedAgentId = customer.AssignedAgentId,
            AssignedAgentName = customer.AssignedAgent?.Name ?? "Unassigned",
            AssignedAgentRole = customer.AssignedAgent?.Role?.Name ?? "Sales Executive",
            OriginalLeadSource = lead?.Source ?? (deal != null ? "Direct Pipeline" : "Inbound Conversion"),
            RelatedLeadId = lead?.Id,
            RelatedDealId = deal?.Id,
            RelatedDealTitle = deal?.Title,
            CommittedAmount = customer.TotalValue > 0 ? customer.TotalValue : (deal?.Value ?? 0m),
            ConversionDate = customer.CreatedAt,
            Status = string.IsNullOrWhiteSpace(customer.Status) ? "Active" : customer.Status,
            Notes = customer.Notes,
            CustomFields = customFields,
            LastContactedAt = customer.LastContactedAt,
            UpdatedAt = customer.UpdatedAt
        };

        return Ok(ApiResponse<ConvertedCustomerItemDto>.SuccessResult(dto));
    }
}
