namespace backend.DTOs.Auth;

public class MfaStatusResponseDto
{
    public bool IsTwoFactorEnabled { get; set; }
    public bool IsEnabled => IsTwoFactorEnabled;
    public DateTime? EnabledAt { get; set; }
    public int RemainingRecoveryCodes { get; set; }
    public int RecoveryCodesRemaining => RemainingRecoveryCodes;
    public string? UserEmail { get; set; }
}

public class MfaSetupDto
{
    public string Secret { get; set; } = string.Empty;
    public string QrCodeUri { get; set; } = string.Empty;
    public string ManualEntryKey { get; set; } = string.Empty;
    public List<string> RecoveryCodes { get; set; } = new();
}

public class MfaVerifySetupRequestDto
{
    public string Code { get; set; } = string.Empty;
}

public class MfaVerifySetupResponseDto
{
    public bool IsEnabled { get; set; } = true;
    public DateTime EnabledAt { get; set; } = DateTime.UtcNow;
    public List<string> RecoveryCodes { get; set; } = new();
}

public class MfaChallengeResponseDto
{
    public bool RequiresMfa { get; set; } = true;
    public bool RequiresTwoFactor => RequiresMfa;
    public string ChallengeToken { get; set; } = string.Empty;
    public string TempToken => ChallengeToken;
}

public class MfaLoginVerifyRequestDto
{
    public string? ChallengeToken { get; set; }
    public string? TempToken { get; set; }
    public string Code { get; set; } = string.Empty;

    public string GetToken() => !string.IsNullOrWhiteSpace(ChallengeToken) ? ChallengeToken : TempToken ?? string.Empty;
}

public class MfaRecoveryLoginRequestDto
{
    public string? ChallengeToken { get; set; }
    public string? TempToken { get; set; }
    public string RecoveryCode { get; set; } = string.Empty;

    public string GetToken() => !string.IsNullOrWhiteSpace(ChallengeToken) ? ChallengeToken : TempToken ?? string.Empty;
}

public class MfaDisableRequestDto
{
    public string Password { get; set; } = string.Empty;
    public string? Code { get; set; }
}

public class MfaRegenerateCodesRequestDto
{
    public string Password { get; set; } = string.Empty;
    public string? Code { get; set; }
}
