using backend.DTOs.Common;
using backend.DTOs.Consultations;
using backend.Services.Interfaces;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers.SalesExecutive;

[ApiController]
[Route("api/sales-executive/consultations")]
[Authorize(Roles = "sales_executive,company_admin,sales_manager,super_admin,irm")]
public class SalesExecutiveConsultationsController : ControllerBase
{
    private readonly IConsultationService _consultationService;
    private readonly IValidator<ScheduleConsultationDto> _scheduleValidator;

    public SalesExecutiveConsultationsController(
        IConsultationService consultationService,
        IValidator<ScheduleConsultationDto> scheduleValidator)
    {
        _consultationService = consultationService;
        _scheduleValidator = scheduleValidator;
    }

    /// <summary>
    /// Get paginated list of private wealth advisory consultations conducted by the authenticated executive.
    /// Filters: status ('Scheduled', 'Completed', 'Rescheduled', 'Cancelled', 'No-show'), search.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResult<ConsultationResponseDto>>>> GetConsultations(
        [FromQuery] string? status,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken ct = default)
    {
        var result = await _consultationService.GetConsultationsAsync(status, search, page, pageSize, ct);
        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    /// <summary>
    /// Get single consultation details by ID.
    /// </summary>
    [HttpGet("{id:int}")]
    public async Task<ActionResult<ApiResponse<ConsultationResponseDto>>> GetConsultationById(
        [FromRoute] int id,
        CancellationToken ct)
    {
        var result = await _consultationService.GetConsultationByIdAsync(id, ct);
        if (!result.Success)
            return NotFound(result);

        return Ok(result);
    }

    /// <summary>
    /// Schedule a new private wealth consultation.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<ApiResponse<ConsultationResponseDto>>> ScheduleConsultation(
        [FromBody] ScheduleConsultationDto dto,
        CancellationToken ct)
    {
        var validation = await _scheduleValidator.ValidateAsync(dto, ct);
        if (!validation.IsValid)
        {
            var errors = validation.Errors.Select(e => e.ErrorMessage).ToList();
            return BadRequest(ApiResponse<ConsultationResponseDto>.FailureResult("Validation failed.", errors));
        }

        var result = await _consultationService.ScheduleConsultationAsync(dto, ct);
        if (!result.Success)
            return BadRequest(result);

        return CreatedAtAction(nameof(GetConsultationById), new { id = result.Data!.Id }, result);
    }

    /// <summary>
    /// Reschedule date, change status, or record outcome notes for a consultation.
    /// </summary>
    [HttpPut("{id:int}")]
    public async Task<ActionResult<ApiResponse<ConsultationResponseDto>>> UpdateConsultation(
        [FromRoute] int id,
        [FromBody] UpdateConsultationDto dto,
        CancellationToken ct)
    {
        var result = await _consultationService.UpdateConsultationAsync(id, dto, ct);
        if (!result.Success)
            return NotFound(result);

        return Ok(result);
    }
}
