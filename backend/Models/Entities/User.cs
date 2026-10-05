using backend.Models.Enums;

namespace backend.Models.Entities;

public class User
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;

    public int RoleId { get; set; }
    public Role Role { get; set; } = null!;

    public int? CompanyId { get; set; }
    public Tenant? Company { get; set; }

    public UserStatus Status { get; set; } = UserStatus.Active;
    public DateTime? LastLoginAt { get; set; }
    public string? AvatarUrl { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    /// <summary>Indicates root platform accounts that cannot be deleted or suspended.</summary>
    public bool IsProtected { get; set; } = false;

    /// <summary>Whether two-factor authentication (TOTP) is enforced for this user.</summary>
    public bool IsTwoFactorEnabled { get; set; } = false;

    /// <summary>Base32 encoded secret for RFC 6238 TOTP authenticator.</summary>
    public string? TwoFactorSecret { get; set; }

    /// <summary>JSON array of hashed one-time backup recovery codes.</summary>
    public string? TwoFactorRecoveryCodesJson { get; set; }
}
