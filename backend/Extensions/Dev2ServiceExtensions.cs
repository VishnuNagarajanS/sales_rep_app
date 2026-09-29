using backend.Authentication.Implementations;
using backend.Authentication.Interfaces;
using backend.Services.Implementations;
using backend.Services.Interfaces;
using backend.Validators.Leads;
using FluentValidation;

namespace backend.Extensions;

public static class Dev2ServiceExtensions
{
    public static IServiceCollection AddDev2Services(this IServiceCollection services)
    {
        // 1. HttpContextAccessor for CurrentUserService
        services.AddHttpContextAccessor();

        // 2. User Context & Auth Claim Extraction
        services.AddScoped<ICurrentUserService, CurrentUserService>();

        // 3. Developer 2 Core CRM Sales Pipeline Services
        services.AddScoped<ILeadService, LeadService>();
        services.AddScoped<IFollowupService, FollowupService>();
        services.AddScoped<IConsultationService, ConsultationService>();
        services.AddScoped<ICustomerService, CustomerService>();

        // 4. Register Developer 2 FluentValidators
        services.AddValidatorsFromAssemblyContaining<CreateLeadValidator>();

        return services;
    }
}
