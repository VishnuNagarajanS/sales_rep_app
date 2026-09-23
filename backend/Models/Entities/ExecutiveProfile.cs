namespace backend.Models.Entities;

public class ExecutiveProfile
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public int UserId { get; set; }
    public string? EmployeeId { get; set; }
    public string? Designation { get; set; }
    public string? WorkingHours { get; set; }
    public int MaxActiveLeads { get; set; } = 50;
    public List<string> Skills { get; set; } = new();
    public List<string> Languages { get; set; } = new();
    public List<string> Specializations { get; set; } = new();
    public bool AutoAnswerCalls { get; set; }
    public bool CallRecordingEnabled { get; set; } = true;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
