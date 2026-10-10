using backend.DTOs.Common;
using backend.DTOs.Jamin;
using backend.Services.Interfaces.Jamin;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers.Jamin;

[ApiController]
[Route("api/jamin/site-visits")]
public class JaminSiteVisitsController : JaminTenantControllerBase
{
    private readonly IJaminSiteVisitService _siteVisitService;

    public JaminSiteVisitsController(IJaminSiteVisitService siteVisitService)
    {
        _siteVisitService = siteVisitService;
    }

    /// <summary>
    /// Returns site visits for Jamin Bazaar. Includes Requested, Scheduled, Completed, etc.
    /// </summary>
    [HttpGet]
    [Authorize]
    public async Task<IActionResult> GetSiteVisits([FromQuery] int? agentId, [FromQuery] string? status, [FromQuery] int? leadId, [FromQuery] int? customerId, CancellationToken ct)
    {
        var result = await _siteVisitService.GetSiteVisitsAsync(agentId, status, leadId, customerId, ct);
        if (!result.Success)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, result);
        }
        return Ok(result);
    }

    /// <summary>
    /// Schedules a new site visit directly from the CRM.
    /// </summary>
    [HttpPost]
    [Authorize]
    public async Task<IActionResult> ScheduleSiteVisit([FromBody] ScheduleSiteVisitRequestDto dto, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(dto.CustomerName) || string.IsNullOrWhiteSpace(dto.CustomerPhone))
        {
            return BadRequest(ApiResponse<JaminSiteVisitDto>.FailureResult("Customer Name and Phone are required."));
        }

        var result = await _siteVisitService.ScheduleSiteVisitAsync(dto, ct);
        if (!result.Success)
        {
            return BadRequest(result);
        }

        return Ok(result);
    }

    /// <summary>
    /// Confirms a site visit that was in 'Requested' or 'Pending' status -> moves to 'Scheduled'.
    /// </summary>
    [HttpPut("{id:int}/confirm")]
    [Authorize]
    public async Task<IActionResult> ConfirmSiteVisit(int id, CancellationToken ct)
    {
        var result = await _siteVisitService.ConfirmSiteVisitAsync(id, ct);
        if (!result.Success)
        {
            return NotFound(result);
        }

        return Ok(result);
    }

    /// <summary>
    /// Marks a site visit as 'Completed' and attaches outcome notes.
    /// </summary>
    [HttpPut("{id:int}/complete")]
    [Authorize]
    public async Task<IActionResult> CompleteSiteVisit(int id, [FromBody] UpdateSiteVisitOutcomeDto dto, CancellationToken ct)
    {
        var result = await _siteVisitService.CompleteSiteVisitAsync(id, dto, ct);
        if (!result.Success)
        {
            return NotFound(result);
        }

        return Ok(result);
    }

    /// <summary>
    /// Updates an existing site visit (timings, plot, host agent, status, notes).
    /// </summary>
    [HttpPut("{id:int}")]
    [Authorize]
    public async Task<IActionResult> UpdateSiteVisit(int id, [FromBody] UpdateSiteVisitDto dto, CancellationToken ct)
    {
        var result = await _siteVisitService.UpdateSiteVisitAsync(id, dto, ct);
        if (!result.Success)
        {
            return BadRequest(result);
        }

        return Ok(result);
    }

    /// <summary>
    /// Deletes or cancels a site visit.
    /// </summary>
    [HttpDelete("{id:int}")]
    [Authorize]
    public async Task<IActionResult> DeleteSiteVisit(int id, CancellationToken ct)
    {
        var result = await _siteVisitService.DeleteSiteVisitAsync(id, ct);
        if (!result.Success)
        {
            return NotFound(result);
        }

        return Ok(result);
    }
}

