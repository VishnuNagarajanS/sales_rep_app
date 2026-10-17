using System;
using System.Collections.Generic;

namespace backend.DTOs.SuperAdmin;

public class SystemHealthCheckItemDto
{
    public string Name { get; set; } = string.Empty;
    public string Component { get; set; } = string.Empty;
    public string Status { get; set; } = "Healthy"; // Healthy, Degraded, Unhealthy, Not Configured
    public double LatencyMs { get; set; }
    public string Message { get; set; } = string.Empty;
    public Dictionary<string, object> Details { get; set; } = new();
    public DateTime CheckedAt { get; set; } = DateTime.UtcNow;
}

public class SystemHealthReportDto
{
    public string OverallStatus { get; set; } = "Healthy";
    public int HealthyCount { get; set; }
    public int DegradedCount { get; set; }
    public int UnhealthyCount { get; set; }
    public List<SystemHealthCheckItemDto> Checks { get; set; } = new();
    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;
}
