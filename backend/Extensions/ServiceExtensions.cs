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
        services.AddScoped<IAuthService, AuthService>();

        services.AddDev1Services();

        // 5. Validators
        services.AddValidatorsFromAssemblyContaining<LoginRequestValidator>();

        // 6. Developer 2 CRM Sales Pipeline Services
        services.AddDev2Services();

        return services;
    }
}
