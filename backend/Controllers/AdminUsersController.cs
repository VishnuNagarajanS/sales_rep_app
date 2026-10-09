using backend.DTOs.Admin;
using backend.DTOs.Common;
using backend.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "company_admin,super_admin")]
public class AdminUsersController : ControllerBase
{
    private readonly IAdminUserService _adminUserService;

    public AdminUsersController(IAdminUserService adminUserService)
    {
        _adminUserService = adminUserService;
    }

    private int GetCompanyId(int? explicitCompanyId = null)
    {
        var claim = User.FindFirst("company_id");
        if (claim != null && int.TryParse(claim.Value, out var companyId) && companyId > 0)
        {
            return companyId;
        }

        if (explicitCompanyId.HasValue && explicitCompanyId.Value > 0)
        {
            return explicitCompanyId.Value;
        }

        if (Request.Query.TryGetValue("companyId", out var qCompany) && int.TryParse(qCompany, out var qCid) && qCid > 0)
        {
            return qCid;
        }

        if (Request.Headers.TryGetValue("x-tenant-id", out var tenantHeader) && !string.IsNullOrWhiteSpace(tenantHeader))
        {
            var headerVal = tenantHeader.ToString().Trim().ToLower();
            if (int.TryParse(headerVal, out var tid) && tid > 0) return tid;
            if (headerVal == "ghl" || headerVal == "t-ghl-01" || headerVal == "1") return 1;
            if (headerVal == "jamin" || headerVal == "t-jamin-02" || headerVal == "2") return 2;
        }

        var role = User.FindFirst(ClaimTypes.Role)?.Value;
        if (role == "super_admin")
        {
            return 1;
        }

        return 0;
    }

    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<List<AdminUserDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetUsers(CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == 0) return Forbid(); // Ensure company bound

        var result = await _adminUserService.GetUsersByCompanyAsync(companyId, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id}")]
    [ProducesResponseType(typeof(ApiResponse<AdminUserDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetUser(int id, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == 0) return Forbid();

        var result = await _adminUserService.GetUserByIdAsync(companyId, id, cancellationToken);
        if (!result.Success) return NotFound(result);

        return Ok(result);
    }

    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<AdminUserDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserRequestDto request, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId(request.CompanyId);
        if (companyId == 0) return Forbid();

        var result = await _adminUserService.CreateUserAsync(companyId, request, cancellationToken);
        if (!result.Success) return BadRequest(result);

        return Ok(result);
    }

    [HttpPut("{id}")]
    [ProducesResponseType(typeof(ApiResponse<AdminUserDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateUser(int id, [FromBody] UpdateUserRequestDto request, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == 0) return Forbid();

        var result = await _adminUserService.UpdateUserAsync(companyId, id, request, cancellationToken);
        if (!result.Success) return BadRequest(result);

        return Ok(result);
    }

    [HttpPost("{id}/transfer-role")]
    [ProducesResponseType(typeof(ApiResponse<AdminUserDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> TransferDataAndUpdateRole(int id, [FromBody] TransferRoleRequestDto request, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == 0) return Forbid();

        var result = await _adminUserService.TransferDataAndUpdateRoleAsync(companyId, id, request, cancellationToken);
        if (!result.Success) return BadRequest(result);

        return Ok(result);
    }

    [HttpDelete("{id}")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    public async Task<IActionResult> DeleteUser(int id, CancellationToken cancellationToken)
    {
        var companyId = GetCompanyId();
        if (companyId == 0) return Forbid();

        var result = await _adminUserService.DeleteUserAsync(companyId, id, cancellationToken);
        if (!result.Success) return BadRequest(result);

        return Ok(result);
    }
}
