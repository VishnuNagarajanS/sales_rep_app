using backend.Models.Entities;

namespace backend.Authentication.Interfaces;

public interface IJwtService
{
    string GenerateToken(User user);
    (string Token, string Jti, DateTime ExpiresAt) GenerateTokenWithDetails(User user);
}
