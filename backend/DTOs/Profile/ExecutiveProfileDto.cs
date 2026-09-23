namespace backend.DTOs.Profile;

public class ExecutiveProfileDto
{
    public int UserId { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public string Phone { get; init; } = string.Empty;
    public string? EmployeeId { get; init; }
    public string? Designation { get; init; }
    public string? WorkingHours { get; init; }
    public int MaxActiveLeads { get; init; }
    public IReadOnlyList<string> Skills { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Languages { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Specializations { get; init; } = Array.Empty<string>();
    public bool AutoAnswerCalls { get; init; }
    public bool CallRecordingEnabled { get; init; }
}
