namespace backend.Models.Entities;

public class SiteVisit
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public Tenant? Tenant { get; set; }

    public int? LeadId { get; set; }
    public Lead? Lead { get; set; }

    /// <summary>Optional FK to customers. Set when scheduled for an existing customer.</summary>
    public int? CustomerId { get; set; }
    public Customer? Customer { get; set; }

    /// <summary>Optional FK to jamin_projects. Set when visiting a project site.</summary>
    public int? ProjectId { get; set; }
    public JaminProject? Project { get; set; }

    /// <summary>Optional FK to jamin_plots. Set when visiting a specific plot.</summary>
    public int? PlotId { get; set; }
    public JaminPlot? Plot { get; set; }

    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string? ContactType { get; set; }

    public string ProjectName { get; set; } = string.Empty;
    public string? PlotNumber { get; set; }

    public string ScheduledAt { get; set; } = string.Empty;
    public int? AssignedAgentId { get; set; }
    public string? AssignedAgentName { get; set; }

    public string Status { get; set; } = "Pending";
    public string? VisitorNote { get; set; }
    public string? OutcomeNotes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
