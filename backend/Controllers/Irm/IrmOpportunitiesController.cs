using backend.DTOs.Common;
using backend.DTOs.Irm;
using backend.Extensions;
using backend.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers.Irm;

[ApiController]
[Route("api/irm/opportunities")]
[Authorize]
public class IrmOpportunitiesController : ControllerBase
{
    private readonly IOpportunityService _oppService;

    public IrmOpportunitiesController(IOpportunityService oppService)
    {
        _oppService = oppService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] bool? isActive, CancellationToken ct)
    {
        var companyId = User.GetCompanyId();
        var result = await _oppService.GetAllAsync(companyId, isActive, ct);
        return Ok(result);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var companyId = User.GetCompanyId();
        var result = await _oppService.GetByIdAsync(id, companyId, ct);
        if (!result.Success)
            return NotFound(result);

        return Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateOpportunityDto dto, CancellationToken ct)
    {
        var companyId = User.GetCompanyId();
        var irmId = User.GetUserId();
        var result = await _oppService.CreateAsync(companyId, irmId, dto, ct);
        if (!result.Success)
            return BadRequest(result);

        return CreatedAtAction(nameof(GetById), new { id = result.Data!.Id }, result);
    }

    [HttpPost("{id:int}/pitch")]
    public async Task<IActionResult> Pitch(int id, [FromBody] PitchOpportunityDto dto, CancellationToken ct)
    {
        var companyId = User.GetCompanyId();
        var irmId = User.GetUserId();
        var result = await _oppService.PitchAsync(id, companyId, irmId, dto, ct);
        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpPost("{id:int}/commit")]
    public async Task<IActionResult> Commit(int id, [FromBody] CommitOpportunityDto dto, CancellationToken ct)
    {
        var companyId = User.GetCompanyId();
        var result = await _oppService.CommitAsync(id, companyId, dto, ct);
        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpGet("{id:int}/pitches")]
    public async Task<IActionResult> GetPitches(int id, CancellationToken ct)
    {
        var companyId = User.GetCompanyId();
        var result = await _oppService.GetPitchesAsync(id, companyId, ct);
        return Ok(result);
    }
}
