namespace backend.DTOs.Reports;

public class DispositionBreakdownDto
{
    public string Disposition { get; init; } = string.Empty;
    public int Count { get; init; }
    public double Percentage { get; init; }
}
