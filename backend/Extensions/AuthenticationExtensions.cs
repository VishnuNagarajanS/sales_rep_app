using System.Text;
using backend.Configuration;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.IdentityModel.Tokens;

namespace backend.Extensions;

public static class AuthenticationExtensions
{
    public static IServiceCollection AddJwtAuthentication(this IServiceCollection services, IConfiguration configuration)
    {
        var jwtSettings = configuration.GetSection(JwtSettings.SectionName).Get<JwtSettings>() 
                          ?? throw new InvalidOperationException("JwtSettings section is missing in configuration.");

        if (string.IsNullOrWhiteSpace(jwtSettings.SecretKey) || jwtSettings.SecretKey.Length < 32)
        {
            throw new InvalidOperationException("JwtSettings:SecretKey must be at least 32 characters long. Set it via the JwtSettings__SecretKey environment variable or a backend/.env file.");
        }

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
                        var cache = context.HttpContext.RequestServices.GetService<Microsoft.Extensions.Caching.Memory.IMemoryCache>();
                        string userCacheKey = $"user_validated_{userId}";
                        backend.Models.Entities.User? user = null;

                        if (cache == null || !cache.TryGetValue(userCacheKey, out user) || user == null)
                        {
                            var dbContext = context.HttpContext.RequestServices.GetRequiredService<backend.Data.ApplicationDbContext>();
                            user = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstOrDefaultAsync(
                                dbContext.Users.AsNoTracking()
                                    .Include(u => u.Role)
                                    .Include(u => u.Company),
                                u => u.Id == userId);

                            if (user != null && cache != null)
                            {
                                cache.Set(userCacheKey, user, TimeSpan.FromSeconds(20));
                            }
                        }

                        if (user == null || user.Status != backend.Models.Enums.UserStatus.Active)
                        {
                            cache?.Remove(userCacheKey);
                            context.Fail("Your account has been suspended or is inactive.");
                            return;
                        }

                        // Enforce Tenant Suspension: Non-super-admins cannot access if tenant is suspended
                        var roleCode = context.Principal?.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value?.ToLowerInvariant();
                        if (user.CompanyId.HasValue && roleCode != "super_admin")
                        {
                            var tenant = user.Company;
                            if (tenant == null || !tenant.IsActive || tenant.Status == "Suspended")
                            {
                                context.Fail("Your organization account has been suspended or is inactive.");
                                return;
                            }
                        }

                        // Enforce Session Revocation: Check if this specific JWT Jti token was revoked (lean projection + cache)
                        var jti = context.Principal?.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Jti)?.Value;
                        if (!string.IsNullOrEmpty(jti))
                        {
                            string jtiKey = $"session_revoked_{jti}";
                            if (cache == null || !cache.TryGetValue(jtiKey, out bool isRevoked))
                            {
                                var dbContext = context.HttpContext.RequestServices.GetRequiredService<backend.Data.ApplicationDbContext>();
                                var session = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstOrDefaultAsync(
                                    dbContext.UserSessions.AsNoTracking()
                                        .Where(s => s.TokenId == jti)
                                        .Select(s => new { s.IsActive, s.RevokedAt }));

                                isRevoked = session != null && (!session.IsActive || session.RevokedAt.HasValue);
                                cache?.Set(jtiKey, isRevoked, TimeSpan.FromSeconds(20));
                            }

                            if (isRevoked)
                            {
                                context.Fail("This session has been revoked. Please sign in again.");
                                return;
                            }
                        }

                        // Zero out sensitive credentials before caching in request scope
                        user.PasswordHash = string.Empty;
                        user.TwoFactorSecret = null;
                        user.TwoFactorRecoveryCodesJson = null;

                        // Store verified user for downstream reuse within this single HTTP request
                        context.HttpContext.Items["ValidatedCurrentUser"] = user;
                    }
                }
            };
        });

        return services;
    }
}
