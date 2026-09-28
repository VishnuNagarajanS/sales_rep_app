using backend.DTOs.Common;
using backend.DTOs.Irm;
using backend.Extensions;
using backend.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers.Irm;

[ApiController]
[Route("api/irm/kyc")]
public class IrmKycController : ControllerBase
{
    private readonly IKycService _kycService;

    public IrmKycController(IKycService kycService)
    {
        _kycService = kycService;
    }

    [HttpGet("{investorId:int}")]
    [Authorize]
    public async Task<IActionResult> GetByInvestorId(int investorId, CancellationToken ct)
    {
        var companyId = User.GetCompanyId();
        var result = await _kycService.GetByInvestorIdAsync(investorId, companyId, ct);
        if (!result.Success)
            return NotFound(result);

        return Ok(result);
    }

    [HttpPost("send-link")]
    [Authorize]
    public async Task<IActionResult> SendKycLink([FromBody] SendKycLinkDto dto, CancellationToken ct)
    {
        var companyId = User.GetCompanyId();
        var irmId = User.GetUserId();
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
        var companyId = User.Identity?.IsAuthenticated == true ? User.GetCompanyId() : 1;
        var result = await _kycService.SubmitKycAsync(companyId, dto, ct);
        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpPost("{id:int}/review")]
    [Authorize]
    public async Task<IActionResult> ReviewKyc(int id, [FromBody] KycReviewDto dto, CancellationToken ct)
    {
        var companyId = User.GetCompanyId();
        var result = await _kycService.ReviewKycAsync(id, companyId, dto, ct);
        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }
}
