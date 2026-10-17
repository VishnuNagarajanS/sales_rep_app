using System;
using System.Collections.Generic;

namespace backend.DTOs.Customers;

public class ConvertedCustomerItemDto
{
    public int Id { get; set; }
    public string CustomerCode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public int CompanyId { get; set; }
    public string CompanyName { get; set; } = string.Empty;
    public string CompanySlug { get; set; } = string.Empty;
    public int AssignedAgentId { get; set; }
    public string AssignedAgentName { get; set; } = string.Empty;
    public string AssignedAgentRole { get; set; } = string.Empty;
    public string? OriginalLeadSource { get; set; }
    public int? RelatedLeadId { get; set; }
    public int? RelatedDealId { get; set; }
    public string? RelatedDealTitle { get; set; }
    public decimal CommittedAmount { get; set; }
    public DateTime ConversionDate { get; set; }
    public string Status { get; set; } = "Active";
    public string Notes { get; set; } = string.Empty;
    public Dictionary<string, string> CustomFields { get; set; } = new();
    public DateTime? LastContactedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class ConvertedCustomerSummaryDto
{
    public int TotalConvertedCustomers { get; set; }
    public decimal TotalCommittedAmount { get; set; }
    public decimal AverageCommittedValue { get; set; }
    public int ConvertedThisMonth { get; set; }
}

public class ConvertedCustomerListResponseDto
{
    public ConvertedCustomerSummaryDto Summary { get; set; } = new();
    public List<ConvertedCustomerItemDto> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages { get; set; }
}

public class ConvertedCustomerQueryParams
{
    public string? Search { get; set; }
    public int? TenantId { get; set; }
    public int? AgentId { get; set; }
    public string? Status { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public string? SortBy { get; set; } = "conversionDate";
    public string? SortOrder { get; set; } = "desc";
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 10;
}
