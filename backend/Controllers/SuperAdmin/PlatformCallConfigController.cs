using backend.DTOs.Common;
using backend.DTOs.SuperAdmin;
using backend.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers.SuperAdmin;

[ApiController]
[Authorize(Roles = "super_admin")]
[Route("api/super-admin/call-config")]
[Route("api/platform/call-config")]
public class PlatformCallConfigController : ControllerBase
{
    private readonly IPlatformCallConfigService _callConfigService;

    public PlatformCallConfigController(IPlatformCallConfigService callConfigService)
    {
        _callConfigService = callConfigService;
    }

    [HttpGet("dids")]
    public async Task<ActionResult<ApiResponse<List<TenantDidMappingDto>>>> GetAllDids(
        [FromQuery] int? tenantId,
        [FromQuery] string? status,
        CancellationToken ct = default)
    {
        var result = await _callConfigService.GetAllDidsAsync(tenantId, status, ct);
        return Ok(result);
    }

    [HttpPost("dids")]
    public async Task<ActionResult<ApiResponse<TenantDidMappingDto>>> CreateDid(
        [FromBody] CreateDidMappingDto dto,
        CancellationToken ct = default)
    {
        var result = await _callConfigService.CreateDidAsync(dto, ct);
        if (!result.Success) return BadRequest(result);
        return Ok(result);
    }

    [HttpPut("dids/{id}")]
    public async Task<ActionResult<ApiResponse<TenantDidMappingDto>>> UpdateDid(
        int id,
        [FromBody] UpdateDidMappingDto dto,
        CancellationToken ct = default)
    {
        var result = await _callConfigService.UpdateDidAsync(id, dto, ct);
        if (!result.Success) return BadRequest(result);
        return Ok(result);
    }

    [HttpDelete("dids/{id}")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteDid(int id, CancellationToken ct = default)
    {
        var result = await _callConfigService.DeleteDidAsync(id, ct);
        if (!result.Success) return BadRequest(result);
        return Ok(result);
    }

    [HttpGet("carrier")]
    public async Task<ActionResult<ApiResponse<PlatformCarrierSettingsDto>>> GetCarrierSettings(CancellationToken ct = default)
    {
        var result = await _callConfigService.GetCarrierSettingsAsync(ct);
        return Ok(result);
    }

    [HttpPut("carrier")]
    public async Task<ActionResult<ApiResponse<PlatformCarrierSettingsDto>>> UpdateCarrierSettings(
        [FromBody] UpdateCarrierSettingsDto dto,
        CancellationToken ct = default)
    {
        var result = await _callConfigService.UpdateCarrierSettingsAsync(dto, ct);
        if (!result.Success) return BadRequest(result);
        return Ok(result);
    }

    [HttpPost("test-carrier")]
    public async Task<ActionResult<ApiResponse<CarrierTestResultDto>>> TestCarrierConnection(CancellationToken ct = default)
    {
        var result = await _callConfigService.TestCarrierConnectionAsync(ct);
        return Ok(result);
    }
}
