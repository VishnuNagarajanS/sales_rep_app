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
        var connectionString = configuration.GetConnectionString("DefaultConnection")
                               ?? throw new InvalidOperationException("DefaultConnection connection string is not configured.");

        services.AddDbContext<ApplicationDbContext>(options =>
            options.UseNpgsql(connectionString));

        // 2. Options pattern & Caching
        services.Configure<JwtSettings>(configuration.GetSection(JwtSettings.SectionName));
        services.Configure<SmtpSettings>(configuration.GetSection(SmtpSettings.SectionName));
        services.AddMemoryCache();

        // 3. Repositories
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IInvestorRepository, InvestorRepository>();
        services.AddScoped<IConsultationRepository, ConsultationRepository>();
        services.AddScoped<IFollowupRepository, FollowupRepository>();
        services.AddScoped<IInvestorCallRepository, InvestorCallRepository>();
        services.AddScoped<IIrmPipelineRepository, IrmPipelineRepository>();
        services.AddScoped<IKycRepository, KycRepository>();
        services.AddScoped<IOpportunityRepository, OpportunityRepository>();

        // 4. Services
        services.AddScoped<IJwtService, JwtService>();
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUserService, CurrentUserService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IAdminUserService, AdminUserService>();
        services.AddScoped<ILeadService, LeadService>();
        services.AddScoped<ICustomerService, CustomerService>();
        services.AddScoped<IFollowupService, FollowupService>();
        services.AddScoped<IConsultationService, ConsultationService>();
        services.AddScoped<backend.Services.Email.IEmailService, backend.Services.Email.SmtpEmailService>();
        services.AddScoped<backend.Services.Interfaces.IEmailService, backend.Services.Implementations.EmailService>();
        services.AddScoped<IOtpService, OtpService>();
        services.AddScoped<IInvestorService, InvestorService>();
        services.AddScoped<IIrmDashboardService, IrmDashboardService>();
        services.AddScoped<IKycService, KycService>();
        services.AddScoped<IOpportunityService, OpportunityService>();
        services.AddScoped<IInvestorCallService, InvestorCallService>();
        services.AddScoped<IIrmFollowupService, IrmFollowupService>();
        services.AddScoped<IIrmPipelineService, IrmPipelineService>();

        services.AddDev1Services();
        services.AddDev2Services();

        // Jamin Bazaar Domain Services
        services.AddScoped<backend.Services.Interfaces.Jamin.IJaminSiteVisitService, backend.Services.Implementations.Jamin.JaminSiteVisitService>();
        services.AddScoped<backend.Services.Interfaces.Jamin.IJaminLeadService, backend.Services.Implementations.Jamin.JaminLeadService>();
        services.AddScoped<backend.Services.Interfaces.Jamin.IJaminProjectService, backend.Services.Implementations.Jamin.JaminProjectService>();
        services.AddScoped<backend.Services.Interfaces.Jamin.IJaminPlotService, backend.Services.Implementations.Jamin.JaminPlotService>();
        services.AddScoped<backend.Services.Interfaces.Jamin.IJaminBookingService, backend.Services.Implementations.Jamin.JaminBookingService>();

        // 5. Validators
        services.AddValidatorsFromAssemblyContaining<LoginRequestValidator>();

        return services;
    }
}
