namespace backend.DTOs.Reports;

public class ExecutiveReportDto
{
    public int TotalCalls { get; init; }
    public int InboundCalls { get; init; }
    public int OutboundCalls { get; init; }
    public int TotalDurationSeconds { get; init; }
    public double AverageDurationSeconds { get; init; }
    public double ConnectRatePercent { get; init; }
    public IReadOnlyList<DispositionBreakdownDto> Dispositions { get; init; } = Array.Empty<DispositionBreakdownDto>();
    public int FollowupsCompletedOnTime { get; init; }
    public int FollowupsOverdue { get; init; }
    public double FollowupAdherencePercent { get; init; }
}
