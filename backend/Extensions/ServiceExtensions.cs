using backend.Authentication.Implementations;
using backend.Authentication.Interfaces;
using backend.Configuration;
using backend.Data;
using backend.Repositories.Implementations;
using backend.Repositories.Interfaces;
using backend.Services.Implementations;
using backend.Services.Interfaces;
using backend.Validators.Auth;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace backend.Extensions;

public static class ServiceExtensions
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<SmtpSettings>(configuration.GetSection(SmtpSettings.SectionName));
        services.Configure<TwilioSettings>(configuration.GetSection(TwilioSettings.SectionName));

        // 1. Database Context
        services.AddMemoryCache();
        services.AddHttpClient("TwilioRecordings");

        var connectionString = configuration.GetConnectionString("DefaultConnection");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            connectionString = configuration["ConnectionStrings:DefaultConnection"]
                ?? configuration["ConnectionString:DefaultConnection"];
        }
        var hasValidConnectionString = !string.IsNullOrWhiteSpace(connectionString) && !connectionString.Equals("InMemory", StringComparison.OrdinalIgnoreCase);
        var useInMemory = configuration.GetValue<bool>("UseInMemoryDatabase", !hasValidConnectionString) || !hasValidConnectionString;

        services.AddDbContext<ApplicationDbContext>(options =>
        {
            if (useInMemory)
            {
                options.UseInMemoryDatabase("NexusSalesDb");
            }
            else
            {
                options.UseNpgsql(connectionString);
            }
        });

        // 2. Options pattern
        services.Configure<JwtSettings>(configuration.GetSection(JwtSettings.SectionName));

        // 3. Repositories
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IConsultationRepository, ConsultationRepository>();
        services.AddScoped<IFollowupRepository, FollowupRepository>();
        services.AddScoped<IInvestorCallRepository, InvestorCallRepository>();
        services.AddScoped<IInvestorRepository, InvestorRepository>();
        services.AddScoped<IIrmPipelineRepository, IrmPipelineRepository>();
        services.AddScoped<IKycRepository, KycRepository>();
        services.AddScoped<IOpportunityRepository, OpportunityRepository>();

        // 4. Services
        services.AddScoped<IJwtService, JwtService>();
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUserService, CurrentUserService>();
        services.AddScoped<ITotpService, TotpService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IAdminUserService, AdminUserService>();
        services.AddScoped<ILeadService, LeadService>();
        services.AddScoped<backend.Services.Email.IEmailService, backend.Services.Email.SmtpEmailService>();
        services.AddScoped<backend.Services.Interfaces.IEmailService, backend.Services.Implementations.EmailService>();
        services.AddScoped<IOtpService, OtpService>();
        services.AddScoped<IInvestorService, InvestorService>();
        services.AddScoped<IIrmDashboardService, IrmDashboardService>();
        services.AddScoped<IConsultationService, ConsultationService>();
        services.AddScoped<ICustomerService, CustomerService>();
        services.AddScoped<IFollowupService, FollowupService>();
        services.AddScoped<IInvestorCallService, InvestorCallService>();
        services.AddScoped<IIrmFollowupService, IrmFollowupService>();
        services.AddScoped<IIrmPipelineService, IrmPipelineService>();
        services.AddScoped<IKycService, KycService>();
        services.AddScoped<IOpportunityService, OpportunityService>();

        services.AddDev1Services();

        // 5. Validators
        services.AddValidatorsFromAssemblyContaining<LoginRequestValidator>();

        return services;
    }
}
