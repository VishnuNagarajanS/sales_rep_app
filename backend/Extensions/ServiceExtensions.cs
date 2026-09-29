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

        // 2. Options pattern
        services.Configure<JwtSettings>(configuration.GetSection(JwtSettings.SectionName));

        // 3. Repositories
        services.AddScoped<IUserRepository, UserRepository>();

        // 4. Services
        services.AddScoped<IJwtService, JwtService>();
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUserService, CurrentUserService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IAdminUserService, AdminUserService>();
        services.AddScoped<ILeadService, LeadService>();
        services.AddScoped<backend.Services.Email.IEmailService, backend.Services.Email.SmtpEmailService>();
        services.AddScoped<IOtpService, OtpService>();
        services.AddScoped<IInvestorService, InvestorService>();
        services.AddScoped<IIrmDashboardService, IrmDashboardService>();

        services.AddDev1Services();

        // 5. Validators
        services.AddValidatorsFromAssemblyContaining<LoginRequestValidator>();

        return services;
    }
}
