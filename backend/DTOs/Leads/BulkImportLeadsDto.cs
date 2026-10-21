namespace backend.DTOs.Leads;

public class BulkImportLeadItemDto
{
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Location { get; set; }
    public string? Source { get; set; }
    public string? Status { get; set; }
    public int? AssignedAgentId { get; set; }
}

public class BulkImportLeadsDto
{
    public List<BulkImportLeadItemDto> Leads { get; set; } = new();
}

public class BulkImportLeadsResultDto
{
    public int Created { get; set; }
    public int Skipped { get; set; }
    public int Total { get; set; }
    public List<string> SkipReasons { get; set; } = new();
}
