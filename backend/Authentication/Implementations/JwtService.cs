using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using backend.Authentication.Interfaces;
using backend.Configuration;
using backend.Models.Entities;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace backend.Authentication.Implementations;

public class JwtService : IJwtService
{
    private readonly JwtSettings _jwtSettings;

    public JwtService(IOptions<JwtSettings> jwtOptions)
    {
        _jwtSettings = jwtOptions.Value;
    }

    public string GenerateToken(User user)
    {
        return GenerateTokenWithDetails(user).Token;
    }

    public (string Token, string Jti, DateTime ExpiresAt) GenerateTokenWithDetails(User user)
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes(_jwtSettings.SecretKey);
        var jti = Guid.NewGuid().ToString();

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new(JwtRegisteredClaimNames.Jti, jti),
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.Name),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Role, user.Role.Code),
            new("userId", user.Id.ToString())
        };

        if (user.CompanyId.HasValue)
        {
            claims.Add(new Claim("company_id", user.CompanyId.Value.ToString()));
            claims.Add(new Claim("companyId", user.CompanyId.Value.ToString()));
        }

        if (user.Role?.Permissions != null)
        {
            foreach (var perm in user.Role.Permissions)
            {
                claims.Add(new Claim("permission", perm));
            }
        }

        if (!string.IsNullOrEmpty(user.Company?.Slug))
        {
            claims.Add(new Claim("company_slug", user.Company.Slug));
        }

        if (user.Role != null)
        {
            if (user.Role.Permissions != null && user.Role.Permissions.Count > 0)
            {
                foreach (var permission in user.Role.Permissions)
                {
                    claims.Add(new Claim("permission", permission));
                }

                // If it's a custom role, grant matching role capability claims so existing controller Authorize attributes allow access
                if (!user.Role.IsSystemRole)
                {
                    var perms = user.Role.Permissions;
                    if (perms.Any(p => p.StartsWith("leads.") || p.StartsWith("calls.") || p.StartsWith("consultations.") || p.StartsWith("reports.") || p.StartsWith("customers.")))
                    {
                        claims.Add(new Claim(ClaimTypes.Role, "sales_executive"));
                    }
                    if (perms.Any(p => p.StartsWith("users.") || p.StartsWith("companies.") || p.StartsWith("audit.")))
                    {
                        claims.Add(new Claim(ClaimTypes.Role, "company_admin"));
                    }
                    if (perms.Any(p => p.StartsWith("investors.") || p.StartsWith("opportunities.") || p.StartsWith("kyc.") || p.StartsWith("deals.")))
                    {
                        claims.Add(new Claim(ClaimTypes.Role, "irm"));
                    }
                }
            }
        }

        var expiresAt = DateTime.UtcNow.AddMinutes(_jwtSettings.ExpirationMinutes);
        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = expiresAt,
            Issuer = _jwtSettings.Issuer,
            Audience = _jwtSettings.Audience,
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        return (tokenHandler.WriteToken(token), jti, expiresAt);
    }
}
