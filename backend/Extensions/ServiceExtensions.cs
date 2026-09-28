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
        // 1. Database Context
        var useInMemory = configuration.GetValue<bool>("UseInMemoryDatabase", true)
                          || string.IsNullOrEmpty(configuration.GetConnectionString("DefaultConnection"))
                          || configuration.GetConnectionString("DefaultConnection")!.Equals("InMemory", StringComparison.OrdinalIgnoreCase);

        var connectionString = configuration.GetConnectionString("DefaultConnection");

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
        services.Configure<SmtpSettings>(configuration.GetSection(SmtpSettings.SectionName));

        // 3. Repositories
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IInvestorRepository, InvestorRepository>();
        services.AddScoped<IKycRepository, KycRepository>();
        services.AddScoped<IConsultationRepository, ConsultationRepository>();
        services.AddScoped<IOpportunityRepository, OpportunityRepository>();
        services.AddScoped<IIrmPipelineRepository, IrmPipelineRepository>();
        services.AddScoped<IFollowupRepository, FollowupRepository>();
        services.AddScoped<IInvestorCallRepository, InvestorCallRepository>();

        // Memory Cache for real-time OTP and session states
        services.AddMemoryCache();

        // 4. Services
        services.AddScoped<IJwtService, JwtService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IEmailService, EmailService>();
        services.AddScoped<IOtpService, OtpService>();
        services.AddScoped<IInvestorService, InvestorService>();
        services.AddScoped<IKycService, KycService>();
        services.AddScoped<IConsultationService, ConsultationService>();
        services.AddScoped<IOpportunityService, OpportunityService>();
        services.AddScoped<IIrmPipelineService, IrmPipelineService>();
        services.AddScoped<IIrmFollowupService, IrmFollowupService>();
        services.AddScoped<IInvestorCallService, InvestorCallService>();
        services.AddScoped<IIrmDashboardService, IrmDashboardService>();

        // 5. Validators
        services.AddValidatorsFromAssemblyContaining<LoginRequestValidator>();

        return services;
    }
}
