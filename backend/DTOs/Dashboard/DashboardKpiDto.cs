namespace backend.DTOs.Dashboard;

public class DashboardKpiDto
{
    public int Value { get; init; }
    public int WeeklyDelta { get; init; }
    public string Label { get; init; } = string.Empty;
}
