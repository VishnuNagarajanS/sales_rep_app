namespace backend.Models.Entities;

/// <summary>
/// GHL India Ventures – Activity log entry for a pipeline deal.
/// Records every note, call, WhatsApp message, meeting,
/// and stage-change action made by a Sales Executive or IRM officer.
/// One deal has many activities (1:N).
/// </summary>
public class GhlDealActivity
{
    public int Id { get; set; }

    public int DealId { get; set; }
    public GhlDeal? Deal { get; set; }

    public int CompanyId { get; set; }
    public Tenant? Company { get; set; }

    /// <summary>
    /// Activity type: note | call | whatsapp | meeting | stage_change
    /// </summary>
    public string Type { get; set; } = "note";

    /// <summary>Human-readable activity text / body.</summary>
    public string Text { get; set; } = string.Empty;

    /// <summary>Previous stage key – only populated for stage_change activities.</summary>
    public string? FromStage { get; set; }

    /// <summary>New stage key – only populated for stage_change activities.</summary>
    public string? ToStage { get; set; }

    /// <summary>Display name of the person who logged this activity.</summary>
    public string LoggedByName { get; set; } = string.Empty;

    /// <summary>Role label of the logger (e.g. "IRM", "Sales Executive").</summary>
    public string LoggedByRole { get; set; } = string.Empty;

    /// <summary>UTC timestamp when the activity was recorded.</summary>
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
