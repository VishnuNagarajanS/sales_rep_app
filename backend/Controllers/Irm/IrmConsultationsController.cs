using backend.DTOs.Common;
using backend.DTOs.Irm;
using backend.Extensions;
using backend.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers.Irm;

[ApiController]
[Route("api/irm/consultations")]
[Authorize]
public class IrmConsultationsController : ControllerBase
{
    private readonly IConsultationService _consultationService;

    public IrmConsultationsController(IConsultationService consultationService)
    {
        _consultationService = consultationService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int? consultantId,
        [FromQuery] string? status,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        CancellationToken ct)
    {
        var companyId = User.GetCompanyId();
        var result = await _consultationService.GetAllAsync(companyId, consultantId, status, from, to, ct);
        return Ok(result);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var companyId = User.GetCompanyId();
        var result = await _consultationService.GetByIdAsync(id, companyId, ct);
        if (!result.Success)
            return NotFound(result);

        return Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateConsultationDto dto, CancellationToken ct)
    {
        var companyId = User.GetCompanyId();
        var consultantId = User.GetUserId();
        var result = await _consultationService.CreateAsync(companyId, consultantId, dto, ct);
        if (!result.Success)
            return BadRequest(result);

        return CreatedAtAction(nameof(GetById), new { id = result.Data!.Id }, result);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateConsultationDto dto, CancellationToken ct)
    {
        var companyId = User.GetCompanyId();
        var result = await _consultationService.UpdateAsync(id, companyId, dto, ct);
        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpPut("{id:int}/outcome")]
    public async Task<IActionResult> RecordOutcome(int id, [FromBody] ConsultationOutcomeDto dto, CancellationToken ct)
    {
        var companyId = User.GetCompanyId();
        var result = await _consultationService.RecordOutcomeAsync(id, companyId, dto, ct);
        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var companyId = User.GetCompanyId();
        var result = await _consultationService.DeleteAsync(id, companyId, ct);
        if (!result.Success)
            return NotFound(result);

        return Ok(result);
    }
}
