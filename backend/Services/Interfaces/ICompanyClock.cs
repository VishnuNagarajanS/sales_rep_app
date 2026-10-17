namespace backend.Services.Interfaces;

public interface ICompanyClock
{
    Task<TimeZoneInfo> GetTimeZoneAsync(int companyId, CancellationToken ct = default);
    Task<DateTime> GetTodayAsync(int companyId, CancellationToken ct = default);
    Task<DateOnly> GetCompanyTodayAsync(int companyId, CancellationToken ct = default);
    Task<DateTime> GetNowAsync(int companyId, CancellationToken ct = default);
}
