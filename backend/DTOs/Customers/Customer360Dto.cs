using backend.DTOs.Followups;

namespace backend.DTOs.Customers;

public class Customer360CallSummaryDto
{
    public int Id { get; set; }
    public int? AgentId { get; set; }
    public string? AgentName { get; set; }
    public string ContactName { get; set; } = string.Empty;
    public string ContactPhone { get; set; } = string.Empty;
    public string Direction { get; set; } = string.Empty;
    public int Duration { get; set; }
    public string Disposition { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;
    public int? LeadId { get; set; }
    public int? CustomerId { get; set; }
    public DateTime Timestamp { get; set; }
}

public class Customer360Dto
{
    public CustomerResponseDto Customer { get; set; } = new();
    public List<Customer360CallSummaryDto> Calls { get; set; } = new();
    public List<FollowupResponseDto> Followups { get; set; } = new();
    public List<backend.DTOs.Jamin.JaminSiteVisitDto> SiteVisits { get; set; } = new();
    public List<backend.DTOs.Jamin.JaminBookingResponseDto> Bookings { get; set; } = new();
    public int TotalCalls => Calls.Count;
    public int PendingFollowupsCount => Followups.Count(f => f.Status == "Pending");

    // Dynamic Financial Metrics derived strictly from authoritative booking and payment records
    public decimal TotalContractValue => Bookings.Where(b => b.Status != "Cancelled" && b.Status != "Voided").Sum(b => b.ContractValue);
    public decimal TotalVerifiedReceipts => Bookings.Sum(b => b.VerifiedReceipts);
    public decimal TotalRefunds => Bookings.Sum(b => b.TotalRefunds);
    public decimal TotalNetCashReceived => Bookings.Sum(b => b.NetCashReceived);
    public decimal TotalContractBalance => Bookings.Where(b => b.Status != "Cancelled" && b.Status != "Voided").Sum(b => b.ContractBalance);
}
