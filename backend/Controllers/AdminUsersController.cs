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

    private int GetCompanyId()
    {
        var claim = User.FindFirst("company_id");
        if (claim != null && int.TryParse(claim.Value, out var companyId))
        {
            return companyId;
        }
        return 0; // Fallback or throw exception depending on security design
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
        var companyId = GetCompanyId();
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
