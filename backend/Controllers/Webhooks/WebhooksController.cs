using backend.Data;
using backend.DTOs.Common;
using backend.Models.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace backend.Controllers.Webhooks;

[ApiController]
[Route("api/[controller]")]
public class WebhooksController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<WebhooksController> _logger;

    public WebhooksController(ApplicationDbContext context, ILogger<WebhooksController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpPost("leads")]
    public async Task<ActionResult<ApiResponse<string>>> SubmitLead([FromBody] WebsiteLeadSubmissionDto request, CancellationToken ct)
    {
        _logger.LogInformation("Received website lead for {Email}", request.Email);

        // Assign to GHL India Ventures (CompanyId = 1) by default if not specified
        int companyId = 1;

        // Website leads must land unassigned
        
        var newLead = new Lead
        {
            Name = request.FullName,
            Email = request.Email,
            Phone = request.Phone,
            Location = request.City,
            Source = "Website Inbound",
            Status = "New",
            Priority = "Medium",
            Notes = request.Message,
            CompanyId = companyId,
            AssignedAgentId = null,
            CreatedAt = DateTime.UtcNow,
            CustomFieldsJson = JsonSerializer.Serialize(new
            {
                investmentCapacity = request.InvestmentAmount,
                isAccredited = request.IsAccredited
            })
        };

        _context.Leads.Add(newLead);
        await _context.SaveChangesAsync(ct);

        _logger.LogInformation("Successfully saved lead {LeadId} from website.", newLead.Id);

        return Ok(ApiResponse<string>.SuccessResult("Lead captured successfully."));
    }
}

public class WebsiteLeadSubmissionDto
{
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string InvestmentAmount { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public bool IsAccredited { get; set; }
}
