namespace backend.Models.Entities;

/// <summary>
/// Jamin Bazaar — Land Development Project.
/// Each project contains multiple plots that can be booked by customers.
/// </summary>
public class JaminProject
{
    public int Id { get; set; }

    public int CompanyId { get; set; }
    public Tenant? Company { get; set; }

    /// <summary>Project name, e.g. "Greenfield Meadows Phase 2".</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Physical location, e.g. "Devanahalli North, Bengaluru".</summary>
    public string Location { get; set; } = string.Empty;

    /// <summary>Active | Upcoming | Completed | On Hold.</summary>
    public string Status { get; set; } = "Active";

    /// <summary>Marketing description for the project.</summary>
    public string Description { get; set; } = string.Empty;

    public int TotalPlots { get; set; }
    public int AvailablePlots { get; set; }
    public int BookedPlots { get; set; }

    /// <summary>Display string like "₹45 Lakhs - ₹75 Lakhs".</summary>
    public string PriceRange { get; set; } = string.Empty;

    /// <summary>Optional image/brochure URL.</summary>
    public string? ImageUrl { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation
    public ICollection<JaminPlot> Plots { get; set; } = new List<JaminPlot>();
    public ICollection<JaminBooking> Bookings { get; set; } = new List<JaminBooking>();
    public ICollection<SiteVisit> SiteVisits { get; set; } = new List<SiteVisit>();
}
