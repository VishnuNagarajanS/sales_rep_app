using backend.Services.Implementations;
using backend.Services.Interfaces;

namespace backend.Extensions;

public static class Dev1ServiceExtensions
{
    public static IServiceCollection AddDev1Services(this IServiceCollection services)
    {
        services.AddHttpContextAccessor();
        services.AddScoped<ICallService, CallService>();
        services.AddScoped<IExecutiveDashboardService, ExecutiveDashboardService>();
        services.AddScoped<IExecutiveProfileService, ExecutiveProfileService>();
        services.AddScoped<IExecutiveReportService, ExecutiveReportService>();
        services.AddScoped<INotificationService, NotificationService>();
        return services;
    }
}
