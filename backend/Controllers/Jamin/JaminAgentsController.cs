using backend.Data;
using backend.DTOs.Common;
using backend.Models.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers.Jamin;

public class JaminAgentDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string RoleName { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
}

[ApiController]
[Route("api/jamin/agents")]
public class JaminAgentsController : JaminTenantControllerBase
{
    private readonly ApplicationDbContext _context;

    public JaminAgentsController(ApplicationDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Returns all active sales persons/agents belonging strictly to the Jamin Bazaar tenant (CompanyId = 2).
    /// </summary>
    [HttpGet]
    [Authorize]
    public async Task<IActionResult> GetAgents(CancellationToken ct)
    {
        var agents = await _context.Users
            .Include(u => u.Role)
            .Where(u => u.CompanyId == JaminCompanyId 
                     && u.Status == UserStatus.Active 
                     && (u.Role.Code == "sales_executive" || u.Role.Code == "sales_manager"))
            .OrderBy(u => u.Name)
            .Select(u => new JaminAgentDto
            {
                Id = u.Id,
                Name = u.Name,
                Email = u.Email,
                Phone = u.Phone ?? string.Empty,
                RoleName = u.Role != null ? u.Role.Name : "Sales Executive",
                AvatarUrl = u.AvatarUrl
            })
            .ToListAsync(ct);

        return Ok(ApiResponse<List<JaminAgentDto>>.SuccessResult(agents));
    }
}
