using backend.DTOs.Common;
using backend.DTOs.Profile;
using backend.Services.Interfaces;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers.SalesExecutive;

[ApiController, Authorize(Roles = "sales_executive,company_admin,sales_manager,super_admin,irm"), Route("api/sales-executive/profile")]
public sealed class SalesExecutiveProfileController(IExecutiveProfileService service, IValidator<UpdateProfileDto> validator) : ControllerBase
{
    [HttpGet] public async Task<IActionResult> Get(CancellationToken cancellationToken) { var result = await service.GetAsync(cancellationToken); return result == null ? NotFound() : Ok(ApiResponse<ExecutiveProfileDto>.SuccessResult(result)); }
    [HttpPatch] public async Task<IActionResult> Update(UpdateProfileDto request, CancellationToken cancellationToken) { var validation = await validator.ValidateAsync(request, cancellationToken); if (!validation.IsValid) return BadRequest(validation.Errors.Select(x => x.ErrorMessage)); var result = await service.UpdateAsync(request, cancellationToken); return result == null ? NotFound() : Ok(ApiResponse<ExecutiveProfileDto>.SuccessResult(result, "Profile updated")); }
}
