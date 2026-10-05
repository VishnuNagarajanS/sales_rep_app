namespace backend.Models.Entities;

public class IrmCoverageAssignment
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public Tenant? Company { get; set; }
    public int OriginalIrmId { get; set; }
    public User? OriginalIrm { get; set; }
    public int CoveringIrmId { get; set; }
    public User? CoveringIrm { get; set; }
    public int ReassignedByUserId { get; set; }
    public string ReassignedByUserName { get; set; } = string.Empty;
    public string ReassignedByUserEmail { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    public DateTime? EndedAt { get; set; }
    public bool IsActive { get; set; } = true;
    /// <summary>JSON storing IDs of all records reassigned during this coverage: { leadIds: [], followupIds: [], kycIds: [], dealIds: [], investorIds: [] }</summary>
    public string ReassignedRecordIdsJson { get; set; } = "{}";
}
