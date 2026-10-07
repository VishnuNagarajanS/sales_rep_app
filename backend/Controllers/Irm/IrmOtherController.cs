using backend.DTOs.Common;
using backend.DTOs.Irm;
using backend.Extensions;
using backend.Services.Implementations;
using backend.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers.Irm;

[ApiController]
[Route("api/irm")]
[Authorize]
public class IrmOtherController : ControllerBase
{
    private readonly IIrmOtherService _otherService;

    public IrmOtherController(IIrmOtherService otherService)
    {
        _otherService = otherService;
    }

    [HttpGet("other")]
    public async Task<IActionResult> GetOtherRecords(
        [FromQuery] string? module,
        [FromQuery] string? search,
        [FromQuery] int? irmId,
        CancellationToken ct)
    {
        var companyId = User.GetCompanyId();
        var role = User.GetUserRole().ToLowerInvariant();
        int? effectiveIrmId = (role == "irm") ? User.GetUserId() : irmId;

        var result = await _otherService.GetOtherRecordsAsync(companyId, effectiveIrmId, module, search, ct);
        return Ok(result);
    }

    [HttpGet("call-outcomes")]
    public IActionResult GetCallOutcomes([FromQuery] string? module)
    {
        var result = _otherService.GetCallOutcomes();
        if (!string.IsNullOrWhiteSpace(module))
        {
            var normalized = IrmOtherService.NormalizeModule(module);
            if (normalized != null && result.Data != null && result.Data.TryGetValue(normalized, out var list))
            {
                return Ok(ApiResponse<List<string>>.SuccessResponse(list, $"Call outcomes for module {normalized} retrieved."));
            }
        }
        return Ok(result);
    }
}
