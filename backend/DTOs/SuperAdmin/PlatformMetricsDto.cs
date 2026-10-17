namespace backend.DTOs.SuperAdmin;

public class PlatformMetricsDto
{
    public int TotalTenants { get; set; }
    public int ActiveTenants { get; set; }
    public int OnboardingTenants { get; set; }
    public int SuspendedTenants { get; set; }
    public int TotalUsers { get; set; }
    public int ActiveUsers { get; set; }
    public int SuperAdminCount { get; set; }
    public int CompanyAdminCount { get; set; }
    public int SalesExecutiveCount { get; set; }
    public int IrmCount { get; set; }
    public int TotalCalls { get; set; }
    public int CallsToday { get; set; }
    public int CallsConnected { get; set; }
    public int CallsFailed { get; set; }
    public int CallsDurationToday { get; set; }
    public double CallSuccessRate { get; set; }
    public int TotalLeads { get; set; }
    public int CurrentMonthLeads { get; set; }
    public int PreviousMonthLeads { get; set; }
    public long TotalPipelineValue { get; set; }
    public int TotalCustomers { get; set; }
    public double SystemHealthScore { get; set; }
}
