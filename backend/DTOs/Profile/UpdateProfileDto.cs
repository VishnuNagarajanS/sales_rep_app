namespace backend.DTOs.Profile;

public class UpdateProfileDto
{
    public string? Name { get; set; }
    public string? Phone { get; set; }
    public string? Designation { get; set; }
    public string? WorkingHours { get; set; }
    public int? MaxActiveLeads { get; set; }
    public List<string>? Skills { get; set; }
    public List<string>? Languages { get; set; }
    public List<string>? Specializations { get; set; }
    public bool? AutoAnswerCalls { get; set; }
    public bool? CallRecordingEnabled { get; set; }
}
