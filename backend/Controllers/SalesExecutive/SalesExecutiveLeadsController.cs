using backend.DTOs.Common;
using backend.DTOs.Leads;
using backend.Services.Interfaces;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers.SalesExecutive;

[ApiController]
[Route("api/sales-executive/leads")]
[Authorize(Roles = "sales_executive,company_admin,sales_manager,super_admin,irm")]
public class SalesExecutiveLeadsController : ControllerBase
{
    private readonly ILeadService _leadService;
    private readonly IValidator<CreateLeadDto> _createValidator;
    private readonly IValidator<UpdateLeadDto> _updateValidator;

    public SalesExecutiveLeadsController(
        ILeadService leadService,
        IValidator<CreateLeadDto> createValidator,
        IValidator<UpdateLeadDto> updateValidator)
    {
        _leadService = leadService;
        _createValidator = createValidator;
        _updateValidator = updateValidator;
    }

    /// <summary>
    /// Get paginated list of active leads owned by the authenticated Sales Executive.
    /// Excludes leads with status 'Not Interested', 'Junk', and 'Converted'.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResult<LeadResponseDto>>>> GetActiveLeads(
        [FromQuery] LeadFilterDto filter,
        CancellationToken ct)
    {
        var result = await _leadService.GetActiveLeadsAsync(filter, ct);
        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    /// <summary>
    /// Get single lead details by ID.
    /// </summary>
    [HttpGet("{id:int}")]
    public async Task<ActionResult<ApiResponse<LeadResponseDto>>> GetLeadById(
        [FromRoute] int id,
        CancellationToken ct)
    {
        var result = await _leadService.GetLeadByIdAsync(id, ct);
        if (!result.Success)
            return NotFound(result);

        return Ok(result);
    }

    /// <summary>
    /// Create a new lead assigned to the authenticated Sales Executive.
    /// Supports GHL custom fields (investmentCapacity, assetClass, preferredAssetClass, horizon).
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<ApiResponse<LeadResponseDto>>> CreateLead(
        [FromBody] CreateLeadDto dto,
        CancellationToken ct)
    {
        var validation = await _createValidator.ValidateAsync(dto, ct);
        if (!validation.IsValid)
        {
            var errors = validation.Errors.Select(e => e.ErrorMessage).ToList();
            return BadRequest(ApiResponse<LeadResponseDto>.FailureResult("Validation failed.", errors));
        }

        var result = await _leadService.CreateLeadAsync(dto, ct);
        if (!result.Success)
            return BadRequest(result);

        return CreatedAtAction(nameof(GetLeadById), new { id = result.Data!.Id }, result);
    }

    /// <summary>
    /// Update an existing lead owned by the authenticated Sales Executive.
    /// </summary>
    [HttpPut("{id:int}")]
    public async Task<ActionResult<ApiResponse<LeadResponseDto>>> UpdateLead(
        [FromRoute] int id,
        [FromBody] UpdateLeadDto dto,
        CancellationToken ct)
    {
        var validation = await _updateValidator.ValidateAsync(dto, ct);
        if (!validation.IsValid)
        {
            var errors = validation.Errors.Select(e => e.ErrorMessage).ToList();
            return BadRequest(ApiResponse<LeadResponseDto>.FailureResult("Validation failed.", errors));
        }

        var result = await _leadService.UpdateLeadAsync(id, dto, ct);
        if (!result.Success)
            return NotFound(result);

        return Ok(result);
    }

    /// <summary>
    /// Convert an active lead into a Customer 360 profile.
    /// </summary>
    [HttpPost("{id:int}/convert")]
    public async Task<ActionResult<ApiResponse<object>>> ConvertLead(
        [FromRoute] int id,
        [FromBody] ConvertLeadDto dto,
        CancellationToken ct)
    {
        var result = await _leadService.ConvertLeadAsync(id, dto, ct);
        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    /// <summary>
    /// Get paginated leads with status 'Not Interested' owned by the authenticated Sales Executive.
    /// </summary>
    [HttpGet("not-interested")]
    public async Task<ActionResult<ApiResponse<PagedResult<LeadResponseDto>>>> GetNotInterestedLeads(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken ct = default)
    {
        var result = await _leadService.GetNotInterestedLeadsAsync(page, pageSize, ct);
        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    /// <summary>
    /// Get paginated leads with status 'Junk' owned by the authenticated Sales Executive.
    /// </summary>
    [HttpGet("junk")]
    public async Task<ActionResult<ApiResponse<PagedResult<LeadResponseDto>>>> GetJunkLeads(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken ct = default)
    {
        var result = await _leadService.GetJunkLeadsAsync(page, pageSize, ct);
        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    /// <summary>
    /// Re-engage a Not-Interested or Junk lead back to 'Contacted', clearing stale tasks and scheduling next followup.
    /// </summary>
    [HttpPost("{id:int}/reengage")]
    public async Task<ActionResult<ApiResponse<LeadResponseDto>>> ReengageLead(
        [FromRoute] int id,
        CancellationToken ct)
    {
        var result = await _leadService.ReengageLeadAsync(id, ct);
        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }
}
