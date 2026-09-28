using backend.DTOs.Common;
using backend.DTOs.Customers;
using backend.Services.Interfaces;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers.SalesExecutive;

[ApiController]
[Route("api/sales-executive/customers")]
[Authorize(Roles = "sales_executive,company_admin,sales_manager,super_admin,irm")]
public class SalesExecutiveCustomersController : ControllerBase
{
    private readonly ICustomerService _customerService;
    private readonly IValidator<CreateCustomerDto> _createValidator;

    public SalesExecutiveCustomersController(
        ICustomerService customerService,
        IValidator<CreateCustomerDto> createValidator)
    {
        _customerService = customerService;
        _createValidator = createValidator;
    }

    /// <summary>
    /// Get paginated list of customers assigned to the authenticated Sales Executive.
    /// Filters: status ('Active', 'VIP', 'Inactive'), search by name/phone/location.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResult<CustomerResponseDto>>>> GetCustomers(
        [FromQuery] string? status,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken ct = default)
    {
        var result = await _customerService.GetCustomersAsync(status, search, page, pageSize, ct);
        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    /// <summary>
    /// Get complete Customer 360 Cockpit view:
    /// Contact info, portfolio value, status, related call logs, and scheduled follow-ups.
    /// </summary>
    [HttpGet("{id:int}")]
    public async Task<ActionResult<ApiResponse<Customer360Dto>>> GetCustomer360(
        [FromRoute] int id,
        CancellationToken ct)
    {
        var result = await _customerService.GetCustomer360ByIdAsync(id, ct);
        if (!result.Success)
            return NotFound(result);

        return Ok(result);
    }

    /// <summary>
    /// Create a new customer profile assigned to the authenticated Sales Executive.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<ApiResponse<CustomerResponseDto>>> CreateCustomer(
        [FromBody] CreateCustomerDto dto,
        CancellationToken ct)
    {
        var validation = await _createValidator.ValidateAsync(dto, ct);
        if (!validation.IsValid)
        {
            var errors = validation.Errors.Select(e => e.ErrorMessage).ToList();
            return BadRequest(ApiResponse<CustomerResponseDto>.FailureResult("Validation failed.", errors));
        }

        var result = await _customerService.CreateCustomerAsync(dto, ct);
        if (!result.Success)
            return BadRequest(result);

        return CreatedAtAction(nameof(GetCustomer360), new { id = result.Data!.Id }, result);
    }

    /// <summary>
    /// Update customer details, investment status, or custom fields.
    /// </summary>
    [HttpPut("{id:int}")]
    public async Task<ActionResult<ApiResponse<CustomerResponseDto>>> UpdateCustomer(
        [FromRoute] int id,
        [FromBody] UpdateCustomerDto dto,
        CancellationToken ct)
    {
        var result = await _customerService.UpdateCustomerAsync(id, dto, ct);
        if (!result.Success)
            return NotFound(result);

        return Ok(result);
    }
}
