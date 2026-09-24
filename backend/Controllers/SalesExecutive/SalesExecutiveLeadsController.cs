using backend.DTOs.Common;
using backend.DTOs.Leads;
using backend.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers.SalesExecutive;

[ApiController, Authorize(Roles = "super_admin,company_admin,sales_manager,sales_executive"), Route("api/sales-executive/leads")]
public sealed class SalesExecutiveLeadsController(ILeadService service) : ControllerBase
{
    [HttpGet] public async Task<IActionResult> Get(CancellationToken cancellationToken) => Ok(ApiResponse<IReadOnlyList<LeadDto>>.SuccessResult(await service.GetAsync(cancellationToken)));
    [HttpPost] public async Task<IActionResult> Create(UpsertLeadDto request, CancellationToken cancellationToken) => Ok(ApiResponse<LeadDto>.SuccessResult(await service.CreateAsync(request, cancellationToken), "Lead created"));
    [HttpPut("{id:int}")] public async Task<IActionResult> Update(int id, UpsertLeadDto request, CancellationToken cancellationToken) { var result = await service.UpdateAsync(id, request, cancellationToken); return result == null ? NotFound() : Ok(ApiResponse<LeadDto>.SuccessResult(result, "Lead updated")); }
    [HttpDelete("{id:int}")] public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken) => await service.DeleteAsync(id, cancellationToken) ? Ok(ApiResponse<object>.SuccessResult(new { }, "Lead deleted")) : NotFound();
}