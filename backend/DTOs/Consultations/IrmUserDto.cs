namespace backend.DTOs.Consultations;

public class IrmUserDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Status { get; set; } = "Available";
    public string Specialization { get; set; } = "Wealth & Private Advisory";
}
