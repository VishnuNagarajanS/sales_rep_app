using backend.DTOs.Common;
using backend.DTOs.Followups;
using backend.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers.SalesExecutive;

[ApiController, Authorize(Roles = "super_admin,company_admin,sales_manager,sales_executive"), Route("api/sales-executive/followups")]
public sealed class SalesExecutiveFollowupsController(IFollowupService service) : ControllerBase
{
    [HttpGet] public async Task<IActionResult> Get(CancellationToken cancellationToken) => Ok(ApiResponse<IReadOnlyList<FollowupDto>>.SuccessResult(await service.GetAsync(cancellationToken)));
    [HttpPost] public async Task<IActionResult> Create(UpsertFollowupDto request, CancellationToken cancellationToken) => Ok(ApiResponse<FollowupDto>.SuccessResult(await service.CreateAsync(request, cancellationToken), "Follow-up created"));
    [HttpPut("{id:int}")] public async Task<IActionResult> Update(int id, UpsertFollowupDto request, CancellationToken cancellationToken) { var result = await service.UpdateAsync(id, request, cancellationToken); return result == null ? NotFound() : Ok(ApiResponse<FollowupDto>.SuccessResult(result, "Follow-up updated")); }
    [HttpDelete("{id:int}")] public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken) => await service.DeleteAsync(id, cancellationToken) ? Ok(ApiResponse<object>.SuccessResult(new { }, "Follow-up deleted")) : NotFound();
}