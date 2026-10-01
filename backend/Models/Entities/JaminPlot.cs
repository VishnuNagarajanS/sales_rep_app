namespace backend.Models.Entities;

/// <summary>
/// Jamin Bazaar — Individual plot within a project layout.
/// Tracks dimensions, pricing, availability, and hold status.
/// </summary>
public class JaminPlot
{
    public int Id { get; set; }

    public int CompanyId { get; set; }
    public Tenant? Company { get; set; }

    public int ProjectId { get; set; }
    public JaminProject? Project { get; set; }

    /// <summary>Plot label, e.g. "Plot #14", "Plot #01 (Corner)".</summary>
    public string PlotNumber { get; set; } = string.Empty;

    /// <summary>Dimensions, e.g. "30 x 40".</summary>
    public string Dimensions { get; set; } = "30 x 40";

    /// <summary>Area in square feet.</summary>
    public int AreaSqFt { get; set; } = 1200;

    /// <summary>Facing direction, e.g. "East", "North-East".</summary>
    public string Facing { get; set; } = "East";

    /// <summary>Available | Hold | Booked | Registered.</summary>
    public string Status { get; set; } = "Available";

    /// <summary>Plot price in INR.</summary>
    public decimal Price { get; set; }

    /// <summary>Price per square foot in INR.</summary>
    public decimal PricePerSqft { get; set; }

    // Hold tracking
    public string? HeldByCustomerName { get; set; }
    public string? HeldByCustomerPhone { get; set; }
    public string? HoldByAgent { get; set; }
    public DateTime? HoldExpiresAt { get; set; }

    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation
    public ICollection<SiteVisit> SiteVisits { get; set; } = new List<SiteVisit>();
    public ICollection<JaminBooking> Bookings { get; set; } = new List<JaminBooking>();
}
