using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.Irm;
using backend.Extensions;
using backend.Models.Entities;
using backend.Models.Enums;
using backend.Services.Implementations;
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

    [HttpGet("by-phone")]
    [Authorize]
    public async Task<IActionResult> GetByPhone([FromQuery] string phone, CancellationToken ct)
    {
        var role = (User.FindFirstValue(ClaimTypes.Role) ?? User.FindFirstValue("role") ?? "").ToLowerInvariant();
        var isPlatformAdmin = role == "admin" || role == "ghl_admin" || role == "super_admin" || role == "company_admin";
        var companyId = User.GetCompanyId(0);
        if (companyId <= 0 && isPlatformAdmin) companyId = 1;
        if (companyId <= 0)
            return Unauthorized();

        var result = await _kycService.GetByPhoneAsync(phone, companyId, ct);
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
        var isSuperAdmin = role == "super_admin";
        var isPlatformAdmin = role == "admin" || role == "ghl_admin" || role == "super_admin" || role == "company_admin";
        var userCompanyId = User.GetCompanyId(1);
        var effectiveCompanyId = (isSuperAdmin && companyId.HasValue && companyId.Value > 0)
            ? companyId.Value
            : userCompanyId;
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
        if (User.IsGhlAdmin())
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<SendKycLinkResponseDto>.ErrorResponse("Access denied: GHL Admin has read-only access to IRM KYC records."));
        }

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
        var hash = KycService.HashToken(rawToken);

        var kyc = await _db.InvestorKycs.FirstOrDefaultAsync(k =>
            (k.KycLinkToken == rawToken || (k.KycTokenHash != null && k.KycTokenHash == hash)), ct);

        if (kyc == null || kyc.IsRevoked || (kyc.KycLinkExpiresAt.HasValue && kyc.KycLinkExpiresAt.Value <= DateTime.UtcNow))
            return BadRequest(ApiResponse<KycDto>.ErrorResponse("Invalid or expired KYC token"));

        if (kyc.Status == KycStatus.Approved || (kyc.SubmittedAt != null && kyc.Status == KycStatus.PendingReview))
            return BadRequest(ApiResponse<KycDto>.ErrorResponse("This KYC link has already been used"));

        // Server-side OTP verification check before accepting submission
        var isOtpVerified = await _otpService.HasVerifiedOtpAsync(rawToken, kyc.Email, ct);
        if (!isOtpVerified)
        {
            return BadRequest(ApiResponse<KycDto>.ErrorResponse("Email OTP verification is required before submitting KYC. Please verify your OTP code."));
        }

        // Derive companyId from the KYC record found by the token, not a hardcoded 1
        var companyId = kyc.CompanyId;

        // Ensure submit only touches the record that matches the token
        dto.InvestorId = kyc.InvestorId;
        dto.Email = kyc.Email;
        dto.Token = kyc.KycLinkToken ?? rawToken;

        var result = await _kycService.SubmitKycAsync(companyId, dto, ct);
        if (!result.Success)
            return BadRequest(result);

        // Only invalidate OTP on final successful submission so draft sessions can continue
        if (dto.IsFinalSubmit)
        {
            await _otpService.InvalidateOtpAsync(rawToken, kyc.Email, ct);
        }

        return Ok(result);
    }

    [HttpPost("assisted-draft")]
    [Authorize]
    public async Task<IActionResult> SaveAssistedDraft([FromBody] SubmitKycDto dto, CancellationToken ct)
    {
        try
        {
            if (User.IsGhlAdmin())
            {
                return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<KycDto>.ErrorResponse("Access denied: GHL Admin has read-only access to IRM KYC records."));
            }

            var role = (User.FindFirstValue(ClaimTypes.Role) ?? User.FindFirstValue("role") ?? "").ToLowerInvariant();
            var isPlatformAdmin = role == "admin" || role == "ghl_admin" || role == "super_admin" || role == "company_admin";
            var companyId = User.GetCompanyId(0);
            if (companyId <= 0 && isPlatformAdmin) companyId = 1;
            if (companyId <= 0)
                return Unauthorized();

            var userId = User.GetUserId();
            if (userId <= 0)
                return Unauthorized();

            dto.IsFinalSubmit = false;
            var result = await _kycService.SaveAssistedKycAsync(companyId, userId, dto, ct);
            if (!result.Success)
                return BadRequest(result);

            if (result.Data != null)
            {
                var kycId = result.Data.Id;
                try
                {
                    GhlDeal? deal = null;
                    if (dto.DealId.HasValue && dto.DealId.Value > 0)
                    {
                        deal = await _db.GhlDeals.FirstOrDefaultAsync(d => d.Id == dto.DealId.Value && d.CompanyId == companyId, ct);
                    }
                    if (deal == null && kycId > 0)
                    {
                        deal = await _db.GhlDeals.FirstOrDefaultAsync(d => d.KycId == kycId && d.CompanyId == companyId, ct);
                    }
                    if (deal == null && dto.InvestorId > 0)
                    {
                        deal = await _db.GhlDeals.FirstOrDefaultAsync(d => d.CustomerId == dto.InvestorId && d.CompanyId == companyId, ct);
                    }
                    if (deal != null && deal.KycId == null)
                    {
                        deal.KycId = kycId;
                        deal.UpdatedAt = DateTime.UtcNow;
                        await _db.SaveChangesAsync(ct);
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[SaveAssistedDraft] Deal link warning: {ex.Message}");
                }
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[SaveAssistedDraft] Error: {ex}");
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse<KycDto>.ErrorResponse($"Error saving assisted draft: {ex.Message}"));
        }
    }

    [HttpPost("assisted-submit")]
    [Authorize]
    public async Task<IActionResult> SubmitAssistedKyc([FromBody] SubmitKycDto dto, CancellationToken ct)
    {
        try
        {
            if (User.IsGhlAdmin())
            {
                return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<KycDto>.ErrorResponse("Access denied: GHL Admin has read-only access to IRM KYC records."));
            }

            var role = (User.FindFirstValue(ClaimTypes.Role) ?? User.FindFirstValue("role") ?? "").ToLowerInvariant();
            var isPlatformAdmin = role == "admin" || role == "ghl_admin" || role == "super_admin" || role == "company_admin";
            var companyId = User.GetCompanyId(0);
            if (companyId <= 0 && isPlatformAdmin) companyId = 1;
            if (companyId <= 0)
                return Unauthorized();

            var userId = User.GetUserId();
            if (userId <= 0)
                return Unauthorized();

            if (!dto.CustomerConsentObtained)
            {
                return BadRequest(ApiResponse<KycDto>.ErrorResponse(
                    "Customer consent is required before submitting assisted KYC. Please obtain and confirm customer consent."));
            }

            dto.IsFinalSubmit = true;
            var result = await _kycService.SaveAssistedKycAsync(companyId, userId, dto, ct);
            if (!result.Success)
                return BadRequest(result);

            // Also update linked deal if present
            if (result.Data != null)
            {
                var kycId = result.Data.Id;
                try
                {
                    GhlDeal? deal = null;
                    if (dto.DealId.HasValue && dto.DealId.Value > 0)
                    {
                        deal = await _db.GhlDeals.FirstOrDefaultAsync(d => d.Id == dto.DealId.Value && d.CompanyId == companyId, ct);
                    }
                    if (deal == null && kycId > 0)
                    {
                        deal = await _db.GhlDeals.FirstOrDefaultAsync(d => d.KycId == kycId && d.CompanyId == companyId, ct);
                    }
                    if (deal == null && dto.InvestorId > 0)
                    {
                        deal = await _db.GhlDeals.FirstOrDefaultAsync(d => d.CustomerId == dto.InvestorId && d.CompanyId == companyId, ct);
                    }
                    if (deal != null)
                    {
                        deal.KycId = kycId;
                        if (deal.KycStatus != "Verified" && deal.KycStatus != "Approved" && result.Data?.Status != "Approved")
                        {
                            deal.KycStatus = "Assisted KYC – Submitted for Verification";
                        }
                        deal.UpdatedAt = DateTime.UtcNow;
                        await _db.SaveChangesAsync(ct);
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[SubmitAssistedKyc] Deal link warning: {ex.Message}");
                }
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[SubmitAssistedKyc] Error: {ex}");
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse<KycDto>.ErrorResponse($"Error submitting assisted KYC: {ex.Message}"));
        }
    }


    [HttpPost("{id:int}/review")]
    [Authorize]
    public async Task<IActionResult> ReviewKyc(int id, [FromBody] KycReviewDto dto, CancellationToken ct)
    {
        if (User.IsGhlAdmin())
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<KycDto>.ErrorResponse("Access denied: GHL Admin has read-only access to IRM KYC records."));
        }

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
                return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<KycDto>.ErrorResponse("Forbidden: User lacks kyc.verify permission."));
            }
        }

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

        var currentDbUser = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        var actorEmail = User.FindFirst(ClaimTypes.Email)?.Value
            ?? User.FindFirst("email")?.Value
            ?? currentDbUser?.Email
            ?? "irm@ghl.com";
        var actorName = User.FindFirst(ClaimTypes.Name)?.Value
            ?? User.FindFirst("name")?.Value
            ?? currentDbUser?.Name
            ?? actorEmail;

        // Write AuditLog
        var audit = new AuditLog
        {
            CompanyId = companyId,
            Timestamp = DateTime.UtcNow,
            ActorName = actorName,
            ActorEmail = actorEmail,
            Action = "KYC_REVIEW",
            EntityType = "InvestorKyc",
            EntityId = id.ToString(),
            Details = $"KYC review completed with action: {dto.Action}. Remarks: {dto.Remarks}",
            Module = "KYC",
            Status = "success"
        };
        _db.AuditLogs.Add(audit);

        // Sync linked GhlDeal KycStatus
        if (result.Data != null)
        {
            var kycData = result.Data;
            var deal = await _db.GhlDeals.Include(d => d.Customer).FirstOrDefaultAsync(d =>
                (d.KycId == id ||
                 (kycData.InvestorId > 0 && d.CustomerId == kycData.InvestorId) ||
                 (d.Customer != null && !string.IsNullOrEmpty(kycData.Email) && d.Customer.Email == kycData.Email)) &&
                d.CompanyId == companyId, ct);

            if (deal != null)
            {
                deal.KycId = id;
                if (dto.Action.Equals("Approved", StringComparison.OrdinalIgnoreCase))
                {
                    deal.KycStatus = "Verified";
                    deal.VerifiedBy = actorEmail;
                    deal.VerifiedAt = DateTime.UtcNow;
                }
                else if (dto.Action.Equals("ReuploadRequested", StringComparison.OrdinalIgnoreCase))
                {
                    deal.KycStatus = "Needs Correction";
                }
                else if (dto.Action.Equals("Rejected", StringComparison.OrdinalIgnoreCase))
                {
                    deal.KycStatus = "Rejected";
                }
                deal.Remarks = dto.Remarks;
                deal.UpdatedAt = DateTime.UtcNow;
            }
        }

        await _db.SaveChangesAsync(ct);

        return Ok(result);
    }

    [HttpPost("{id:int}/revoke-link")]
    [Authorize]
    public async Task<IActionResult> RevokeLink(int id, CancellationToken ct)
    {
        if (User.IsGhlAdmin())
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<bool>.ErrorResponse("Access denied: GHL Admin has read-only access to IRM KYC records."));
        }

        var role = (User.FindFirstValue(ClaimTypes.Role) ?? User.FindFirstValue("role") ?? "").ToLowerInvariant();
        var isPlatformAdmin = role == "admin" || role == "ghl_admin" || role == "super_admin" || role == "company_admin";
        var companyId = User.GetCompanyId(0);
        if (companyId <= 0 && isPlatformAdmin) companyId = 1;
        if (companyId <= 0)
            return Unauthorized();

        var userId = User.GetUserId();
        var result = await _kycService.RevokeKycLinkAsync(id, companyId, isPlatformAdmin ? null : userId, ct);
        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpPost("{id:int}/resend-link")]
    [Authorize]
    public async Task<IActionResult> ResendLink(int id, [FromBody] ResendKycLinkDto? dto, CancellationToken ct)
    {
        if (User.IsGhlAdmin())
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<SendKycLinkResponseDto>.ErrorResponse("Access denied: GHL Admin has read-only access to IRM KYC records."));
        }

        var role = (User.FindFirstValue(ClaimTypes.Role) ?? User.FindFirstValue("role") ?? "").ToLowerInvariant();
        var isPlatformAdmin = role == "admin" || role == "ghl_admin" || role == "super_admin" || role == "company_admin";
        var companyId = User.GetCompanyId(0);
        if (companyId <= 0 && isPlatformAdmin) companyId = 1;
        if (companyId <= 0)
            return Unauthorized();

        var userId = User.GetUserId();
        if (userId <= 0)
            return Unauthorized();

        var result = await _kycService.ResendKycLinkAsync(id, companyId, userId, dto, ct);
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
        if (User.IsGhlAdmin())
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<bool>.ErrorResponse("Access denied: GHL Admin has read-only access to IRM KYC records."));
        }

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
            bool hasRealSubmission = kyc.SubmittedAt != null 
                || kyc.Status == KycStatus.PendingReview 
                || (kyc.IsAssisted && kyc.CustomerConsentObtained);

            if (!hasRealSubmission)
            {
                return StatusCode(StatusCodes.Status409Conflict, ApiResponse<bool>.ErrorResponse("Cannot confirm KYC: No genuine customer submission exists for this record."));
            }

            bool hasNominees = !string.IsNullOrWhiteSpace(kyc.NomineesJson) && kyc.NomineesJson.Trim() != "[]";
            if (dto.Checklist == null || !dto.Checklist.IsValid(hasNominees))
            {
                return BadRequest(ApiResponse<bool>.ErrorResponse("Required checklist items (Identity, Bank, Documents, Demat" + (hasNominees ? ", Nominee" : "") + ") must be manually verified and confirmed."));
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
        var currentDbUser = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        var actorEmail = User.FindFirst(ClaimTypes.Email)?.Value
            ?? User.FindFirst("email")?.Value
            ?? currentDbUser?.Email
            ?? "irm@ghl.com";
        var actorName = User.FindFirst(ClaimTypes.Name)?.Value
            ?? User.FindFirst("name")?.Value
            ?? currentDbUser?.Name
            ?? actorEmail;

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
        var deal = await _db.GhlDeals.Include(d => d.Customer).FirstOrDefaultAsync(d => 
            (d.KycId == kyc.Id || 
             (kyc.InvestorId > 0 && d.CustomerId == kyc.InvestorId) || 
             (d.Customer != null && !string.IsNullOrEmpty(kyc.Email) && d.Customer.Email == kyc.Email)) && 
            d.CompanyId == companyId, ct);
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
        if (User.IsGhlAdmin())
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<bool>.ErrorResponse("Access denied: GHL Admin has read-only access to IRM KYC records."));
        }

        var companyId = User.GetCompanyId(0);
        if (companyId <= 0)
            return Unauthorized();

        var userId    = User.GetUserId();
        if (userId <= 0)
            return Unauthorized();

        var role = (User.FindFirstValue(ClaimTypes.Role) ?? User.FindFirstValue("role") ?? "").ToLowerInvariant();
        var isPlatformAdmin = role == "admin" || role == "ghl_admin" || role == "super_admin" || role == "company_admin";

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

        if (!isPlatformAdmin && kyc.IrmId.HasValue && kyc.IrmId.Value != userId)
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<bool>.ErrorResponse("Access denied: You can only update KYC records assigned to you."));
        }

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
        var currentDbUser = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        var actorEmail = User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value
            ?? User.FindFirst("email")?.Value 
            ?? currentDbUser?.Email 
            ?? "irm@ghl.com";
        var actorName = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value
            ?? User.FindFirst("name")?.Value
            ?? currentDbUser?.Name
            ?? actorEmail;

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
            ActorName  = actorName,
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
