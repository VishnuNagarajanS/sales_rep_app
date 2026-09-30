using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.Irm;
using backend.Extensions;
using backend.Models.Entities;
using backend.Models.Enums;
using backend.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace backend.Controllers.Irm;

[ApiController]
[Route("api/irm/kyc")]
public class IrmKycController : ControllerBase
{
    private readonly IKycService _kycService;
    private readonly IOtpService _otpService;
    private readonly ApplicationDbContext _db;

    public IrmKycController(IKycService kycService, IOtpService otpService, ApplicationDbContext db)
    {
        _kycService = kycService;
        _otpService = otpService;
        _db = db;
    }

    [HttpGet("{id:int}")]
    [Authorize]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var role = (User.FindFirstValue(ClaimTypes.Role) ?? User.FindFirstValue("role") ?? "").ToLowerInvariant();
        var isPlatformAdmin = role == "admin" || role == "ghl_admin" || role == "super_admin" || role == "company_admin";
        var companyId = User.GetCompanyId(0);
        if (companyId <= 0 && isPlatformAdmin) companyId = 1;
        if (companyId <= 0)
            return Unauthorized();

        var result = await _kycService.GetByIdAsync(id, companyId, ct);
        if (!result.Success)
        {
            result = await _kycService.GetByInvestorIdAsync(id, companyId, ct);
        }

        if (!result.Success)
            return NotFound(result);

        if (!isPlatformAdmin)
        {
            var userId = User.GetUserId();
            if (result.Data?.IrmId != null && result.Data.IrmId != userId)
            {
                return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<KycDto>.ErrorResponse("Access denied: You can only view KYC records assigned to you."));
            }
        }

        return Ok(result);
    }

    [HttpGet("by-email")]
    [Authorize]
    public async Task<IActionResult> GetByEmail([FromQuery] string email, CancellationToken ct)
    {
        var role = (User.FindFirstValue(ClaimTypes.Role) ?? User.FindFirstValue("role") ?? "").ToLowerInvariant();
        var isPlatformAdmin = role == "admin" || role == "ghl_admin" || role == "super_admin" || role == "company_admin";
        var companyId = User.GetCompanyId(0);
        if (companyId <= 0 && isPlatformAdmin) companyId = 1;
        if (companyId <= 0)
            return Unauthorized();

        var result = await _kycService.GetByEmailAsync(email, companyId, ct);
        if (!result.Success)
            return NotFound(result);

        if (!isPlatformAdmin)
        {
            var userId = User.GetUserId();
            if (result.Data?.IrmId != null && result.Data.IrmId != userId)
            {
                return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<KycDto>.ErrorResponse("Access denied: You can only view KYC records assigned to you."));
            }
        }

        return Ok(result);
    }

    [HttpGet("all")]
    [Authorize]
    public async Task<IActionResult> GetAllKycs([FromQuery] string? status, [FromQuery] int? companyId, CancellationToken ct)
    {
        var role = (User.FindFirstValue(ClaimTypes.Role) ?? User.FindFirstValue("role") ?? "").ToLowerInvariant();
        var isPlatformAdmin = role == "admin" || role == "ghl_admin" || role == "super_admin" || role == "company_admin";
        var effectiveCompanyId = companyId ?? User.GetCompanyId(0);
        if (effectiveCompanyId <= 0 && isPlatformAdmin) effectiveCompanyId = 1;
        if (effectiveCompanyId <= 0)
            return Unauthorized();

        int? effectiveIrmId = null;
        if (!isPlatformAdmin)
        {
            var userId = User.GetUserId();
            if (userId <= 0)
                return Unauthorized();
            effectiveIrmId = userId;
        }

        var result = await _kycService.GetAllAsync(effectiveCompanyId, status, effectiveIrmId, ct);
        return Ok(result);
    }

    [HttpPost("send-link")]
    [Authorize]
    public async Task<IActionResult> SendKycLink([FromBody] SendKycLinkDto dto, CancellationToken ct)
    {
        var companyId = User.GetCompanyId(0);
        if (companyId <= 0)
            return Unauthorized();

        var irmId = User.GetUserId();
        if (irmId <= 0)
            return Unauthorized();

        var result = await _kycService.SendKycLinkAsync(companyId, irmId, dto, ct);
        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpGet("public/{token}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetByToken(string token, CancellationToken ct)
    {
        var result = await _kycService.GetByTokenAsync(token, ct);
        if (!result.Success)
            return NotFound(result);

        return Ok(result);
    }

    [HttpPost("submit")]
    [AllowAnonymous]
    public async Task<IActionResult> SubmitKyc([FromBody] SubmitKycDto dto, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(dto.Token))
            return BadRequest(ApiResponse<KycDto>.ErrorResponse("Token is required"));

        var rawToken = dto.Token.Trim();
        var subToken = rawToken.StartsWith("tok_") ? rawToken[4..] : rawToken;
        var tokenPrefix = subToken.Contains('_') ? subToken.Split('_')[0] : subToken;

        var kyc = await _db.InvestorKycs.FirstOrDefaultAsync(k =>
            k.KycLinkToken == rawToken ||
            (k.KycLinkToken != null && tokenPrefix.Length >= 8 && k.KycLinkToken.StartsWith(tokenPrefix)), ct);

        if (kyc == null)
            return BadRequest(ApiResponse<KycDto>.ErrorResponse("Invalid or expired KYC token"));

        if (kyc.KycLinkExpiresAt.HasValue && kyc.KycLinkExpiresAt.Value <= DateTime.UtcNow)
            return BadRequest(ApiResponse<KycDto>.ErrorResponse("Invalid or expired KYC token"));

        if (kyc.Status == KycStatus.Approved || (kyc.SubmittedAt != null && kyc.Status == KycStatus.PendingReview))
            return BadRequest(ApiResponse<KycDto>.ErrorResponse("This KYC link has already been used"));

        // Derive companyId from the KYC record found by the token, not a hardcoded 1
        var companyId = kyc.CompanyId;

        // Ensure submit only touches the record that matches the token
        dto.InvestorId = kyc.InvestorId;
        dto.Email = kyc.Email;
        dto.Token = kyc.KycLinkToken ?? rawToken;

        var result = await _kycService.SubmitKycAsync(companyId, dto, ct);
        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpPost("{id:int}/review")]
    [Authorize]
    public async Task<IActionResult> ReviewKyc(int id, [FromBody] KycReviewDto dto, CancellationToken ct)
    {
        var role = (User.FindFirstValue(ClaimTypes.Role) ?? User.FindFirstValue("role") ?? "").ToLowerInvariant();
        var isPlatformAdmin = role == "admin" || role == "ghl_admin" || role == "super_admin" || role == "company_admin";
        var companyId = User.GetCompanyId(0);
        if (companyId <= 0 && isPlatformAdmin) companyId = 1;
        if (companyId <= 0)
            return Unauthorized();

        var userId = User.GetUserId();
        if (!isPlatformAdmin)
        {
            var kycRec = await _db.InvestorKycs.FirstOrDefaultAsync(k => k.Id == id && k.CompanyId == companyId, ct);
            if (kycRec == null) return NotFound(ApiResponse<KycDto>.ErrorResponse("KYC record not found"));
            if (kycRec.IrmId.HasValue && kycRec.IrmId.Value != userId)
                return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<KycDto>.ErrorResponse("Access denied: You can only review KYC records assigned to you."));
        }

        var result = await _kycService.ReviewKycAsync(id, companyId, dto, ct);
        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpPost("otp/send")]
    [AllowAnonymous]
    public async Task<IActionResult> SendOtp([FromBody] SendKycOtpRequestDto dto, CancellationToken ct)
    {
        var result = await _otpService.SendKycOtpAsync(dto, ct);
        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpPost("otp/verify")]
    [AllowAnonymous]
    public async Task<IActionResult> VerifyOtp([FromBody] VerifyKycOtpRequestDto dto, CancellationToken ct)
    {
        var result = await _otpService.VerifyKycOtpAsync(dto, ct);
        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpPatch("{id:int}/status")]
    [Authorize]
    public async Task<IActionResult> UpdateKycStatus(int id, [FromBody] UpdateKycStatusDto dto, CancellationToken ct)
    {
        var role = (User.FindFirstValue(ClaimTypes.Role) ?? User.FindFirstValue("role") ?? "").ToLowerInvariant();
        var isPlatformAdmin = role == "admin" || role == "ghl_admin" || role == "super_admin" || role == "company_admin";
        var companyId = User.GetCompanyId(0);
        if (companyId <= 0 && isPlatformAdmin) companyId = 1;
        if (companyId <= 0)
            return Unauthorized();

        var userId = User.GetUserId();
        if (userId <= 0)
            return Unauthorized();

        // Server-side permission check: user must have kyc.verify
        var hasKycVerifyClaim = User.Claims.Any(c => c.Type == "permission" && c.Value == "kyc.verify");
        if (!hasKycVerifyClaim)
        {
            var dbUser = await _db.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.Id == userId && u.CompanyId == companyId, ct);
            if (dbUser?.Role?.Permissions == null || !dbUser.Role.Permissions.Contains("kyc.verify"))
            {
                return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<bool>.ErrorResponse("Forbidden: User lacks kyc.verify permission."));
            }
        }

        // Enforce record lookup and ownership
        var kyc = await _db.InvestorKycs.FirstOrDefaultAsync(k => k.Id == id && k.CompanyId == companyId, ct);
        if (kyc == null)
            return NotFound(ApiResponse<bool>.ErrorResponse("KYC record not found."));

        if (!isPlatformAdmin && kyc.IrmId.HasValue && kyc.IrmId.Value != userId)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<bool>.ErrorResponse("Access denied: You can only update KYC records assigned to you."));
        }

        if (string.IsNullOrWhiteSpace(dto.Status) || 
            (dto.Status != "Pending" && dto.Status != "Wrong" && dto.Status != "Verified"))
        {
            return BadRequest(ApiResponse<bool>.ErrorResponse("Invalid status. Allowed values: Pending, Wrong, Verified."));
        }

        if (dto.Status == "Verified")
        {
            bool hasSubmitted = kyc.SubmittedAt != null || kyc.Status == KycStatus.PendingReview || kyc.Status == KycStatus.Approved || !string.IsNullOrEmpty(kyc.PanNumber);
            if (!hasSubmitted)
            {
                return StatusCode(StatusCodes.Status409Conflict, ApiResponse<bool>.ErrorResponse("Customer has not submitted KYC yet."));
            }

            if (dto.Checklist != null && !dto.Checklist.IsAllChecked)
            {
                return BadRequest(ApiResponse<bool>.ErrorResponse("All checklist items (Identity, Bank, Documents, Nominee, Demat) must be verified."));
            }
        }
        else if (dto.Status == "Wrong")
        {
            if (string.IsNullOrWhiteSpace(dto.Comment))
            {
                return BadRequest(ApiResponse<bool>.ErrorResponse("Comment is mandatory when marking KYC as Wrong."));
            }
        }

        // Set VerifiedBy & VerifiedAt from authenticated user
        var actorEmail = User.FindFirst(ClaimTypes.Email)?.Value
            ?? User.FindFirst("email")?.Value
            ?? "irm@ghl.com";
        var actorName = User.FindFirst(ClaimTypes.Name)?.Value
            ?? User.FindFirst("name")?.Value
            ?? "IRM Officer";

        var oldStatus = kyc.Status.ToString();

        if (dto.Status == "Verified")
        {
            kyc.VerifiedBy = actorEmail;
            kyc.VerifiedAt = DateTime.UtcNow;
            kyc.Status = KycStatus.Approved;
            kyc.Remarks = dto.Comment;
            kyc.ReviewRemarks = dto.Comment;
            kyc.FlaggedSectionsJson = null;
        }
        else if (dto.Status == "Wrong")
        {
            kyc.VerifiedBy = null;
            kyc.VerifiedAt = null;
            kyc.Status = KycStatus.ReuploadRequested;
            kyc.Remarks = dto.Comment;
            kyc.ReviewRemarks = dto.Comment;
            kyc.FlaggedSectionsJson = dto.FlaggedSections != null ? string.Join(",", dto.FlaggedSections) : null;
        }
        else // Pending
        {
            kyc.VerifiedBy = null;
            kyc.VerifiedAt = null;
            kyc.Status = KycStatus.PendingReview;
            kyc.Remarks = null;
            kyc.ReviewRemarks = null;
            kyc.FlaggedSectionsJson = null;
        }

        kyc.UpdatedAt = DateTime.UtcNow;

        // Write AuditLog
        var audit = new AuditLog
        {
            CompanyId = companyId,
            Timestamp = DateTime.UtcNow,
            ActorName = actorName,
            ActorEmail = actorEmail,
            Action = "UPDATE",
            EntityType = "InvestorKyc",
            EntityId = kyc.Id.ToString(),
            Details = $"KYC status updated to {dto.Status}. Old status: {oldStatus}. Comment: {dto.Comment}. Flagged: {(dto.FlaggedSections != null ? string.Join(", ", dto.FlaggedSections) : "none")}",
            Module = "KYC",
            Status = "success"
        };
        _db.AuditLogs.Add(audit);

        // Update linked GhlDeal if one exists
        var deal = await _db.GhlDeals.FirstOrDefaultAsync(d => (d.KycId == kyc.Id || d.CustomerId == kyc.InvestorId || (!string.IsNullOrEmpty(kyc.Email) && d.CustomerName == kyc.InvestorName)) && d.CompanyId == companyId, ct);
        if (deal != null)
        {
            deal.KycId = kyc.Id;
            deal.KycStatus = dto.Status;
            deal.VerifiedBy = kyc.VerifiedBy;
            deal.VerifiedAt = kyc.VerifiedAt;
            deal.Remarks = kyc.Remarks;
            deal.FlaggedSections = kyc.FlaggedSectionsJson;
            deal.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync(ct);

        return Ok(ApiResponse<object>.SuccessResponse(new
        {
            id = kyc.Id,
            status = dto.Status,
            customerKycStatus = kyc.Status == KycStatus.Approved ? "Verified" : kyc.Status == KycStatus.ReuploadRequested ? "Needs Correction" : "Submitted",
            verifiedBy = kyc.VerifiedBy,
            verifiedAt = kyc.VerifiedAt,
            remarks = kyc.Remarks,
            flaggedSections = dto.FlaggedSections,
            dealId = deal?.Id
        }, $"KYC status updated to {dto.Status}"));
    }

    /// <summary>
    /// PATCH api/irm/kyc/{id}/verification
    /// Saves a per-section draft (aadhaar / pan / bank mark + reason).
    /// Does NOT change the KycStatus — that is done via PATCH {id}/status.
    /// Requires kyc.verify permission.
    /// </summary>
    [HttpPatch("{id:int}/verification")]
    [Authorize]
    public async Task<IActionResult> SaveVerificationDraft(
        int id, [FromBody] SaveVerificationDraftDto dto, CancellationToken ct)
    {
        var companyId = User.GetCompanyId(0);
        if (companyId <= 0)
            return Unauthorized();

        var userId    = User.GetUserId();
        if (userId <= 0)
            return Unauthorized();

        // Permission check — same as status endpoint
        var hasKycVerifyClaim = User.Claims.Any(c => c.Type == "permission" && c.Value == "kyc.verify");
        if (!hasKycVerifyClaim)
        {
            var dbUser = await _db.Users
                .Include(u => u.Role)
                .FirstOrDefaultAsync(u => u.Id == userId && u.CompanyId == companyId, ct);
            if (dbUser?.Role?.Permissions == null || !dbUser.Role.Permissions.Contains("kyc.verify"))
                return StatusCode(StatusCodes.Status403Forbidden,
                    ApiResponse<bool>.ErrorResponse("Forbidden: User lacks kyc.verify permission."));
        }

        var kyc = await _db.InvestorKycs
            .FirstOrDefaultAsync(k => k.Id == id && k.CompanyId == companyId, ct);
        if (kyc == null)
            return NotFound(ApiResponse<bool>.ErrorResponse("KYC record not found."));

        // Validate section statuses
        string[] validStatuses = ["unchecked", "verified", "wrong"];
        if (dto.Aadhaar != null && !validStatuses.Contains(dto.Aadhaar.Status))
            return BadRequest(ApiResponse<bool>.ErrorResponse("Invalid aadhaar status."));
        if (dto.Pan != null && !validStatuses.Contains(dto.Pan.Status))
            return BadRequest(ApiResponse<bool>.ErrorResponse("Invalid pan status."));
        if (dto.Bank != null && !validStatuses.Contains(dto.Bank.Status))
            return BadRequest(ApiResponse<bool>.ErrorResponse("Invalid bank status."));

        // Wrong sections require a non-empty reason
        if (dto.Aadhaar?.Status == "wrong" && string.IsNullOrWhiteSpace(dto.Aadhaar.Reason))
            return BadRequest(ApiResponse<bool>.ErrorResponse("Reason is required when marking aadhaar as wrong."));
        if (dto.Pan?.Status == "wrong" && string.IsNullOrWhiteSpace(dto.Pan.Reason))
            return BadRequest(ApiResponse<bool>.ErrorResponse("Reason is required when marking pan as wrong."));
        if (dto.Bank?.Status == "wrong" && string.IsNullOrWhiteSpace(dto.Bank.Reason))
            return BadRequest(ApiResponse<bool>.ErrorResponse("Reason is required when marking bank as wrong."));

        // Persist as JSON blob — does NOT change KycStatus
        var actorEmail = User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value
            ?? User.FindFirst("email")?.Value ?? "irm@ghl.com";

        kyc.SectionVerificationsJson = System.Text.Json.JsonSerializer.Serialize(new
        {
            aadhaar = dto.Aadhaar != null ? new { dto.Aadhaar.Status, dto.Aadhaar.Reason, reviewedBy = actorEmail, reviewedAt = DateTime.UtcNow } : null,
            pan     = dto.Pan     != null ? new { dto.Pan.Status,     dto.Pan.Reason,     reviewedBy = actorEmail, reviewedAt = DateTime.UtcNow } : null,
            bank    = dto.Bank    != null ? new { dto.Bank.Status,    dto.Bank.Reason,    reviewedBy = actorEmail, reviewedAt = DateTime.UtcNow } : null,
        });
        kyc.UpdatedAt = DateTime.UtcNow;

        // Audit entry
        _db.AuditLogs.Add(new AuditLog
        {
            CompanyId  = companyId,
            Timestamp  = DateTime.UtcNow,
            ActorEmail = actorEmail,
            ActorName  = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value ?? "IRM Officer",
            Action     = "UPDATE",
            EntityType = "InvestorKyc",
            EntityId   = kyc.Id.ToString(),
            Details    = $"Section verification draft saved. Aadhaar:{dto.Aadhaar?.Status} Pan:{dto.Pan?.Status} Bank:{dto.Bank?.Status}",
            Module     = "KYC",
            Status     = "success"
        });

        await _db.SaveChangesAsync(ct);

        return Ok(ApiResponse<object>.SuccessResponse(new
        {
            id         = kyc.Id,
            aadhaar    = dto.Aadhaar?.Status,
            pan        = dto.Pan?.Status,
            bank       = dto.Bank?.Status,
            reviewedBy = actorEmail,
            savedAt    = DateTime.UtcNow
        }, "Verification draft saved."));
    }
}
