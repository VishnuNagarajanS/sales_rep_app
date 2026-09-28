using backend.DTOs.Common;
using backend.DTOs.Irm;
using backend.Extensions;
using backend.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers.Irm;

[ApiController]
[Route("api/irm/investors")]
[Authorize]
public class IrmInvestorsController : ControllerBase
{
    private readonly IInvestorService _investorService;

    public IrmInvestorsController(IInvestorService investorService)
    {
        _investorService = investorService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? status,
        [FromQuery] string? assetClass,
        [FromQuery] int? irmId,
        CancellationToken ct)
    {
        var companyId = User.GetCompanyId();
        var result = await _investorService.GetAllAsync(companyId, status, assetClass, irmId, ct);
        return Ok(result);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var companyId = User.GetCompanyId();
        var result = await _investorService.GetByIdAsync(id, companyId, ct);
        if (!result.Success)
            return NotFound(result);

        return Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateInvestorDto dto, CancellationToken ct)
    {
        var companyId = User.GetCompanyId();
        var irmId = User.GetUserId();
        var result = await _investorService.CreateAsync(companyId, irmId, dto, ct);
        if (!result.Success)
            return BadRequest(result);

        return CreatedAtAction(nameof(GetById), new { id = result.Data!.Id }, result);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateInvestorDto dto, CancellationToken ct)
    {
        var companyId = User.GetCompanyId();
        var result = await _investorService.UpdateAsync(id, companyId, dto, ct);
        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var companyId = User.GetCompanyId();
        var result = await _investorService.DeleteAsync(id, companyId, ct);
        if (!result.Success)
            return NotFound(result);

        return Ok(result);
    }
}
