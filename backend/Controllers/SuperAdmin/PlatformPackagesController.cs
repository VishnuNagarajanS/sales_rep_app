using backend.DTOs.Common;
using backend.DTOs.SuperAdmin;
using backend.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers.SuperAdmin;

[ApiController]
[Authorize(Roles = "super_admin")]
[Route("api/super-admin/packages")]
[Route("api/platform/packages")]
public class PlatformPackagesController : ControllerBase
{
    private readonly IPlatformPackageService _packageService;

    public PlatformPackagesController(IPlatformPackageService packageService)
    {
        _packageService = packageService;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<SubscriptionPackageDto>>>> GetAllPackages(CancellationToken ct = default)
    {
        var result = await _packageService.GetAllPackagesAsync(ct);
        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<SubscriptionPackageDto>>> GetPackageById(int id, CancellationToken ct = default)
    {
        var result = await _packageService.GetPackageByIdAsync(id, ct);
        if (!result.Success) return NotFound(result);
        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<SubscriptionPackageDto>>> CreatePackage(
        [FromBody] CreatePackageDto dto,
        CancellationToken ct = default)
    {
        var result = await _packageService.CreatePackageAsync(dto, ct);
        if (!result.Success) return BadRequest(result);
        return CreatedAtAction(nameof(GetPackageById), new { id = result.Data?.Id }, result);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<ApiResponse<SubscriptionPackageDto>>> UpdatePackage(
        int id,
        [FromBody] UpdatePackageDto dto,
        CancellationToken ct = default)
    {
        var result = await _packageService.UpdatePackageAsync(id, dto, ct);
        if (!result.Success) return BadRequest(result);
        return Ok(result);
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse<bool>>> DeletePackage(int id, CancellationToken ct = default)
    {
        var result = await _packageService.DeletePackageAsync(id, ct);
        if (!result.Success) return BadRequest(result);
        return Ok(result);
    }

    [HttpGet("~/api/super-admin/features/catalog")]
    [HttpGet("~/api/platform/features/catalog")]
    public ActionResult<ApiResponse<List<FeatureCatalogItemDto>>> GetFeatureCatalog()
    {
        var catalog = _packageService.GetFeatureCatalog();
        return Ok(ApiResponse<List<FeatureCatalogItemDto>>.SuccessResult(catalog));
    }
}
