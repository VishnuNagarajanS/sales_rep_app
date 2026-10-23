namespace backend.DTOs.Jamin;

public class WalkTheLandBookingDto
{
    // Step 1: Which development
    public string TargetDevelopment { get; set; } = string.Empty;

    // Step 2: Pick a date
    public string PreferredVisitDate { get; set; } = string.Empty;

    // Step 3: Choose a time
    public string PreferredTimeSlot { get; set; } = string.Empty; // Morning · 9–11 am | Midday · 11 am–1 pm | Afternoon · 2–4 pm | Evening · 4–6 pm

    // Step 4: Your details
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? AnythingWeShouldKnow { get; set; } // "How many of you are coming, whether you need directions, a plot you already have in mind"
    public bool ConsentAccepted { get; set; } = true;
}
