namespace backend.DTOs.SuperAdmin;

public class CallsTodayMetricsDto
{
    public int CallsToday { get; set; }
    public int CallsConnected { get; set; }
    public int CallsFailed { get; set; }
    public int TotalDurationSeconds { get; set; }
    public double SuccessRate { get; set; }
}
