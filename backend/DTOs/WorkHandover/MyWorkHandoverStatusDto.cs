namespace backend.DTOs.WorkHandover;

public class MyWorkHandoverStatusDto
{
    public WorkHandoverDto? ActiveCoverage { get; set; }
    public WorkHandoverDto? ActiveCovering { get; set; }
    public WorkHandoverDto? RecentlyEnded { get; set; }
}
