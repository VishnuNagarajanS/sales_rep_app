using System.Text;
using backend.Configuration;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace backend.Extensions;

public static class AuthenticationExtensions
{
    public static IServiceCollection AddJwtAuthentication(this IServiceCollection services, IConfiguration configuration)
    {
        var jwtSettings = configuration.GetSection(JwtSettings.SectionName).Get<JwtSettings>() 
                          ?? throw new InvalidOperationException("JwtSettings section is missing in configuration.");

        var key = Encoding.UTF8.GetBytes(jwtSettings.SecretKey);

        services.AddAuthentication(options =>
        {
            options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
            options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
        })
        .AddJwtBearer(options =>
        {
            options.RequireHttpsMetadata = false;
            options.SaveToken = true;
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(key),
                ValidateIssuer = true,
                ValidIssuer = jwtSettings.Issuer,
                ValidateAudience = true,
                ValidAudience = jwtSettings.Audience,
                ValidateLifetime = true,
                ClockSkew = TimeSpan.Zero
            };
            options.Events = new JwtBearerEvents
            {
                OnMessageReceived = context =>
                {
                    var accessToken = context.Request.Query["access_token"];
                    var path = context.HttpContext.Request.Path;
                    if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                    {
                        context.Token = accessToken;
                    }
                    return Task.CompletedTask;
                },
                OnTokenValidated = async context =>
                {
                    var userIdClaim = context.Principal?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                                      ?? context.Principal?.FindFirst("sub")?.Value
                                      ?? context.Principal?.FindFirst("userId")?.Value;

                    if (!string.IsNullOrEmpty(userIdClaim) && int.TryParse(userIdClaim, out var userId))
                    {
                        var dbContext = context.HttpContext.RequestServices.GetRequiredService<backend.Data.ApplicationDbContext>();
                        var user = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstOrDefaultAsync(
                            dbContext.Users.AsNoTracking(),
                            u => u.Id == userId);

                        if (user == null || user.Status != backend.Models.Enums.UserStatus.Active)
                        {
                            context.Fail("Your account has been suspended or is inactive.");
                            return;
                        }

                        // Enforce Tenant Suspension: Non-super-admins cannot access if tenant is suspended
                        var roleCode = context.Principal?.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value?.ToLowerInvariant();
                        if (user.CompanyId.HasValue && roleCode != "super_admin")
                        {
                            var tenant = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstOrDefaultAsync(
                                dbContext.Tenants.AsNoTracking(),
                                t => t.Id == user.CompanyId.Value);

                            if (tenant == null || !tenant.IsActive || tenant.Status == "Suspended")
                            {
                                context.Fail("Your organization account has been suspended or is inactive.");
                                return;
                            }
                        }

                        // Enforce Session Revocation: Check if this specific JWT Jti token was revoked
                        var jti = context.Principal?.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Jti)?.Value;
                        if (!string.IsNullOrEmpty(jti))
                        {
                            var session = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstOrDefaultAsync(
                                dbContext.UserSessions.AsNoTracking(),
                                s => s.TokenId == jti);

                            if (session != null && (!session.IsActive || session.RevokedAt.HasValue))
                            {
                                context.Fail("This session has been revoked. Please sign in again.");
                                return;
                            }
                        }
                    }
                }
            };
        });

        return services;
    }
}
