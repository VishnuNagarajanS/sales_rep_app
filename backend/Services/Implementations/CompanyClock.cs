using backend.Data;
using backend.Services.Ai;
using backend.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace backend.Services.Implementations;

public class CompanyClock : ICompanyClock
{
    private readonly ApplicationDbContext _db;
    private readonly AiSettings _aiSettings;

    public CompanyClock(ApplicationDbContext db, IOptionsSnapshot<AiSettings> aiSettings)
    {
        _db = db;
        _aiSettings = aiSettings.Value;
    }

    public async Task<TimeZoneInfo> GetTimeZoneAsync(int companyId, CancellationToken ct = default)
    {
        var tenant = await _db.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == companyId, ct);
        string tzStr = tenant?.Timezone ?? _aiSettings.TimeZone;

        // Clean up descriptive strings like "Asia/Kolkata (IST)" -> "Asia/Kolkata"
        if (tzStr.Contains(" ("))
        {
            tzStr = tzStr.Substring(0, tzStr.IndexOf(" (")).Trim();
        }

        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(tzStr);
        }
        catch
        {
            // Fallback to AiSettings if the tenant's string is completely unparseable
            return TimeZoneInfo.FindSystemTimeZoneById(_aiSettings.TimeZone);
        }
    }

    public async Task<DateTime> GetTodayAsync(int companyId, CancellationToken ct = default)
    {
        var tz = await GetTimeZoneAsync(companyId, ct);
        return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz).Date;
    }

    public async Task<DateOnly> GetCompanyTodayAsync(int companyId, CancellationToken ct = default)
    {
        var tz = await GetTimeZoneAsync(companyId, ct);
        return DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz));
    }

    public async Task<DateTime> GetNowAsync(int companyId, CancellationToken ct = default)
    {
        var tz = await GetTimeZoneAsync(companyId, ct);
        return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
    }
}
