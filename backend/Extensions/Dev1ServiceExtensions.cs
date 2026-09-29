using backend.Services.Implementations;
using backend.Services.Interfaces;

namespace backend.Extensions;

public static class Dev1ServiceExtensions
{
    public static IServiceCollection AddDev1Services(this IServiceCollection services)
    {
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUserService, CurrentUserService>();
        services.AddScoped<ICallService, CallService>();
        services.AddScoped<IExecutiveDashboardService, ExecutiveDashboardService>();
        services.AddScoped<IExecutiveProfileService, ExecutiveProfileService>();
        services.AddScoped<IExecutiveReportService, ExecutiveReportService>();
        services.AddScoped<INotificationService, NotificationService>();
        services.AddScoped<ILeadService, LeadService>();
        services.AddScoped<IFollowupService, FollowupService>();
        services.AddScoped<ICustomerService, CustomerService>();
        services.AddScoped<IConsultationService, ConsultationService>();
        return services;
    }
}
