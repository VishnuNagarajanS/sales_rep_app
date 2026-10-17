namespace backend.DTOs.Admin;

public class UserWorkloadDto
{
    public int UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string RoleCode { get; set; } = string.Empty;

    // General / Sales Executive Workload
    public int LeadsCount { get; set; }
    public int FollowupsCount { get; set; }
    public int DealsCount { get; set; }
    public int CustomersCount { get; set; }
    public int ConsultationsCount { get; set; }

    // IRM-Specific Workload (aligned with IRM navigation pages)
    public int MyLeadsCount { get; set; }
    public int InFollowupCount { get; set; }
    public int KycCount { get; set; }
    public int OpportunitiesCount { get; set; }
    public int ConvertedCount { get; set; }

    public int Total { get; set; }
}
