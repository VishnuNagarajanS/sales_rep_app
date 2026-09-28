using backend.DTOs.Followups;

namespace backend.DTOs.Customers;

public class Customer360CallSummaryDto
{
    public int Id { get; set; }
    public string Direction { get; set; } = string.Empty;
    public int Duration { get; set; }
    public string Disposition { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
}

public class Customer360Dto
{
    public CustomerResponseDto Customer { get; set; } = new();
    public List<Customer360CallSummaryDto> Calls { get; set; } = new();
    public List<FollowupResponseDto> Followups { get; set; } = new();
    public int TotalCalls => Calls.Count;
    public int PendingFollowupsCount => Followups.Count(f => f.Status == "Pending");
}
