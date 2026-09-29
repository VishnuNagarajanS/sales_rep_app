using backend.DTOs.Common;
using backend.DTOs.Irm;
using backend.Extensions;
using backend.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers.Irm;

[ApiController]
[Route("api/irm/pipeline")]
[Authorize]
public class IrmPipelineController : ControllerBase
{
    private readonly IIrmPipelineService _pipelineService;

    public IrmPipelineController(IIrmPipelineService pipelineService)
    {
        _pipelineService = pipelineService;
    }

    [HttpGet]
    public async Task<IActionResult> GetBoard([FromQuery] int? irmId, CancellationToken ct)
    {
        var companyId = User.GetCompanyId();
        var result = await _pipelineService.GetBoardAsync(companyId, irmId, ct);
        return Ok(result);
    }

    [HttpPut("{cardId:int}/move")]
    public async Task<IActionResult> MoveStage(int cardId, [FromBody] MoveIrmStageDto dto, CancellationToken ct)
    {
        var companyId = User.GetCompanyId();
        var irmId = User.GetUserId();
        var result = await _pipelineService.MoveStageAsync(cardId, companyId, irmId, dto, ct);
        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpPost("{cardId:int}/activity")]
    public async Task<IActionResult> LogActivity(int cardId, [FromBody] LogIrmActivityDto dto, CancellationToken ct)
    {
        var companyId = User.GetCompanyId();
        var irmId = User.GetUserId();
        var result = await _pipelineService.LogActivityAsync(cardId, companyId, irmId, dto, ct);
        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }
}
