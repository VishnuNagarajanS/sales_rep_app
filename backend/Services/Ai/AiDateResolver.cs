namespace backend.Services.Ai
{
    public static class AiDateResolver
    {
        public static (DateTime From, DateTime To) ResolveDateRange(string? dateFrom, string? dateTo, TimeZoneInfo tz)
        {
            var today = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz).Date;

            DateTime fromDate = today;
            DateTime toDate = today;

            if (DateTime.TryParse(dateFrom, out var f))
                fromDate = f.Date;

            if (DateTime.TryParse(dateTo, out var t))
                toDate = t.Date;

            if (fromDate > toDate)
                throw new ArgumentException("dateFrom cannot be after dateTo");

            if ((toDate - fromDate).TotalDays > 366)
                throw new ArgumentException("Date range cannot exceed 366 days");

            var fromUtc = TimeZoneInfo.ConvertTimeToUtc(fromDate, tz);
            var toUtc = TimeZoneInfo.ConvertTimeToUtc(toDate.AddDays(1).AddTicks(-1), tz);

            return (fromUtc, toUtc);
        }
    }
}
