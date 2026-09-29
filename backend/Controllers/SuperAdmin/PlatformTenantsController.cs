using backend.DTOs.Common;
using backend.DTOs.SuperAdmin;
using backend.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers.SuperAdmin;

[ApiController]
[Authorize(Roles = "super_admin")]
[Route("api/super-admin/tenants")]
[Route("api/platform/tenants")]
public class PlatformTenantsController : ControllerBase
{
    private readonly IPlatformTenantService _tenantService;

    public PlatformTenantsController(IPlatformTenantService tenantService)
    {
        _tenantService = tenantService;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<PlatformTenantDto>>>> GetAllTenants(
        [FromQuery] string? search,
        [FromQuery] string? status,
        [FromQuery] string? industry,
        CancellationToken ct = default)
    {
        var result = await _tenantService.GetAllTenantsAsync(search, status, industry, ct);
        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<PlatformTenantDetailDto>>> GetTenantById(int id, CancellationToken ct = default)
    {
        var result = await _tenantService.GetTenantByIdAsync(id, ct);
        if (!result.Success) return NotFound(result);
        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<PlatformTenantDto>>> CreateTenant(
        [FromBody] CreateTenantWizardDto dto,
        CancellationToken ct = default)
    {
        var result = await _tenantService.CreateTenantWizardAsync(dto, ct);
        if (!result.Success) return BadRequest(result);
        return Ok(result);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<ApiResponse<PlatformTenantDto>>> UpdateTenant(
        int id,
        [FromBody] UpdateTenantDto dto,
        CancellationToken ct = default)
    {
        var result = await _tenantService.UpdateTenantAsync(id, dto, ct);
        if (!result.Success) return BadRequest(result);
        return Ok(result);
    }

    [HttpPatch("{id}/status")]
    public async Task<ActionResult<ApiResponse<bool>>> UpdateTenantStatus(
        int id,
        [FromBody] UpdateTenantStatusDto dto,
        CancellationToken ct = default)
    {
        var result = await _tenantService.UpdateTenantStatusAsync(id, dto.Status, ct);
        if (!result.Success) return BadRequest(result);
        return Ok(result);
    }

    [HttpPut("{id}/features")]
    public async Task<ActionResult<ApiResponse<List<string>>>> UpdateTenantFeatures(
        int id,
        [FromBody] UpdateTenantFeaturesDto dto,
        CancellationToken ct = default)
    {
        var result = await _tenantService.UpdateTenantFeaturesAsync(id, dto.EnabledFeatures, ct);
        if (!result.Success) return BadRequest(result);
        return Ok(result);
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteTenant(int id, CancellationToken ct = default)
    {
        var result = await _tenantService.DeleteTenantAsync(id, ct);
        if (!result.Success) return BadRequest(result);
        return Ok(result);
    }

    [HttpPost("{id}/impersonate")]
    public async Task<ActionResult<ApiResponse<object>>> ImpersonateTenant(int id, CancellationToken ct = default)
    {
        var result = await _tenantService.ImpersonateTenantAsync(id, ct);
        if (!result.Success) return NotFound(result);
        return Ok(result);
    }
}
