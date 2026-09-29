using backend.DTOs.Common;
using backend.DTOs.SuperAdmin;
using backend.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers.SuperAdmin;

[ApiController]
[Authorize(Roles = "super_admin")]
[Route("api/super-admin/system")]
[Route("api/platform/system")]
public class PlatformSystemController : ControllerBase
{
    private readonly IPlatformSystemService _systemService;

    public PlatformSystemController(IPlatformSystemService systemService)
    {
        _systemService = systemService;
    }

    [HttpGet("diagnostics")]
    public async Task<ActionResult<ApiResponse<SystemDiagnosticsDto>>> GetDiagnostics(CancellationToken ct = default)
    {
        var result = await _systemService.GetSystemDiagnosticsAsync(ct);
        return Ok(result);
    }

    [HttpGet("announcements")]
    public async Task<ActionResult<ApiResponse<List<BroadcastAnnouncementDto>>>> GetAnnouncements(CancellationToken ct = default)
    {
        var result = await _systemService.GetAnnouncementsAsync(ct);
        return Ok(result);
    }

    [HttpPost("announcements")]
    public async Task<ActionResult<ApiResponse<BroadcastAnnouncementDto>>> CreateAnnouncement(
        [FromBody] CreateAnnouncementDto dto,
        CancellationToken ct = default)
    {
        var result = await _systemService.CreateAnnouncementAsync(dto, ct);
        if (!result.Success) return BadRequest(result);
        return Ok(result);
    }

    [HttpPatch("announcements/{id}/toggle")]
    public async Task<ActionResult<ApiResponse<bool>>> ToggleAnnouncement(
        int id,
        [FromBody] bool isActive,
        CancellationToken ct = default)
    {
        var result = await _systemService.ToggleAnnouncementAsync(id, isActive, ct);
        if (!result.Success) return BadRequest(result);
        return Ok(result);
    }

    [HttpDelete("announcements/{id}")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteAnnouncement(int id, CancellationToken ct = default)
    {
        var result = await _systemService.DeleteAnnouncementAsync(id, ct);
        if (!result.Success) return BadRequest(result);
        return Ok(result);
    }

    [HttpGet("maintenance")]
    public async Task<ActionResult<ApiResponse<MaintenanceStatusDto>>> GetMaintenance(CancellationToken ct = default)
    {
        var result = await _systemService.GetMaintenanceStatusAsync(ct);
        return Ok(result);
    }

    [HttpPost("maintenance")]
    public async Task<ActionResult<ApiResponse<MaintenanceStatusDto>>> SetMaintenance(
        [FromBody] SetMaintenanceDto dto,
        CancellationToken ct = default)
    {
        var result = await _systemService.SetMaintenanceStatusAsync(dto, ct);
        return Ok(result);
    }

    [HttpGet("snapshot")]
    public async Task<IActionResult> ExportSnapshot(CancellationToken ct = default)
    {
        var result = await _systemService.ExportPlatformSnapshotAsync(ct);
        return Ok(result);
    }
}
