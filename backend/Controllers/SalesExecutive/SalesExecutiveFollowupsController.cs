using backend.DTOs.Common;
using backend.DTOs.Followups;
using backend.Services.Interfaces;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers.SalesExecutive;

[ApiController]
[Route("api/sales-executive/followups")]
[Authorize(Roles = "sales_executive,company_admin,sales_manager,super_admin,irm")]
public class SalesExecutiveFollowupsController : ControllerBase
{
    private readonly IFollowupService _followupService;
    private readonly IValidator<CreateFollowupDto> _createValidator;

    public SalesExecutiveFollowupsController(
        IFollowupService followupService,
        IValidator<CreateFollowupDto> createValidator)
    {
        _followupService = followupService;
        _createValidator = createValidator;
    }

    /// <summary>
    /// Get paginated follow-ups assigned to the authenticated Sales Executive.
    /// Supports filters: status ('Pending', 'Completed') and scope ('all', 'due', 'overdue').
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResult<FollowupResponseDto>>>> GetFollowups(
        [FromQuery] FollowupFilterDto filter,
        CancellationToken ct)
    {
        var result = await _followupService.GetFollowupsAsync(filter, ct);
        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    /// <summary>
    /// Get single follow-up details by ID.
    /// </summary>
    [HttpGet("{id:int}")]
    public async Task<ActionResult<ApiResponse<FollowupResponseDto>>> GetFollowupById(
        [FromRoute] int id,
        CancellationToken ct)
    {
        var result = await _followupService.GetFollowupByIdAsync(id, ct);
        if (!result.Success)
            return NotFound(result);

        return Ok(result);
    }

    /// <summary>
    /// Schedule a new follow-up reminder.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<ApiResponse<FollowupResponseDto>>> ScheduleFollowup(
        [FromBody] CreateFollowupDto dto,
        CancellationToken ct)
    {
        var validation = await _createValidator.ValidateAsync(dto, ct);
        if (!validation.IsValid)
        {
            var errors = validation.Errors.Select(e => e.ErrorMessage).ToList();
            return BadRequest(ApiResponse<FollowupResponseDto>.FailureResult("Validation failed.", errors));
        }

        var result = await _followupService.CreateFollowupAsync(dto, ct);
        if (!result.Success)
            return BadRequest(result);

        return CreatedAtAction(nameof(GetFollowupById), new { id = result.Data!.Id }, result);
    }

    /// <summary>
    /// Reschedule or update notes/priority of an existing follow-up.
    /// </summary>
    [HttpPut("{id:int}")]
    public async Task<ActionResult<ApiResponse<FollowupResponseDto>>> UpdateFollowup(
        [FromRoute] int id,
        [FromBody] UpdateFollowupDto dto,
        CancellationToken ct)
    {
        var result = await _followupService.UpdateFollowupAsync(id, dto, ct);
        if (!result.Success)
            return NotFound(result);

        return Ok(result);
    }

    /// <summary>
    /// Mark a follow-up task as Completed.
    /// </summary>
    [HttpPatch("{id:int}/complete")]
    public async Task<ActionResult<ApiResponse<FollowupResponseDto>>> CompleteFollowup(
        [FromRoute] int id,
        CancellationToken ct)
    {
        var result = await _followupService.CompleteFollowupAsync(id, ct);
        if (!result.Success)
            return NotFound(result);

        return Ok(result);
    }

    /// <summary>
    /// Delete a follow-up record.
    /// </summary>
    [HttpDelete("{id:int}")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteFollowup(
        [FromRoute] int id,
        CancellationToken ct)
    {
        var result = await _followupService.DeleteFollowupAsync(id, ct);
        if (!result.Success)
            return NotFound(result);

        return Ok(result);
    }
}
