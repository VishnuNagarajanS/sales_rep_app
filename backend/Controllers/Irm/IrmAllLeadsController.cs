using System.Security.Claims;
using System.Text.Json;
using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.Irm;
using backend.Extensions;
using backend.Models.Entities;
using backend.Models.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers.Irm;

[ApiController]
[Route("api/irm/all-leads")]
[Authorize]
public class IrmAllLeadsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<IrmAllLeadsController> _logger;

    public IrmAllLeadsController(ApplicationDbContext db, ILogger<IrmAllLeadsController> logger)
    {
        _db = db;
        _logger = logger;
    }

    private static string GetLast10(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone)) return string.Empty;
        var digits = new string(phone.Where(char.IsDigit).ToArray());
        return digits.Length >= 10 ? digits[^10..] : digits;
    }

    /// <summary>
    /// GET /api/irm/all-leads
    /// Retrieves all leads ever assigned to an IRM with their current real-time stage.
    /// Strict isolation: IRM users can ONLY see leads assigned to themselves.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<IrmAllLeadsSummaryDto>>> GetAllLeads(
        [FromQuery] int? irmId = null,
        [FromQuery] string? search = null,
        [FromQuery] string? stage = null,
        [FromQuery] int? page = null,
        [FromQuery] int? pageSize = null,
        CancellationToken ct = default)
    {
        var role = (User.FindFirstValue(ClaimTypes.Role) ?? User.FindFirstValue("role") ?? "").ToLowerInvariant();
        var isPlatformAdmin = role == "admin" || role == "ghl_admin" || role == "super_admin" || role == "company_admin";
        var isIrm = role == "irm";

        // Access control: only IRMs and Admins can access this endpoint
        if (!isIrm && !isPlatformAdmin)
        {
            return StatusCode(StatusCodes.Status403Forbidden, 
                ApiResponse<IrmAllLeadsSummaryDto>.FailureResult("Access denied: IRM All Leads is restricted to IRM agents and administrators."));
        }

        var companyId = User.GetCompanyId(0);
        if (companyId <= 0 && isPlatformAdmin) companyId = 1;
        if (companyId <= 0)
            return Unauthorized();

        var userId = User.GetUserId();

        // Strict isolation: if logged in as IRM, force target to own userId.
        // IRM1 can NEVER see IRM2's leads even if they pass ?irmId= in the query string.
        int? targetIrmId = isIrm ? userId : irmId;

        _logger.LogInformation("Retrieving All Leads for user {UserId} (role={Role}, targetIrmId={TargetIrmId}, company={CompanyId})",
            userId, role, targetIrmId, companyId);

        var leadsQuery = _db.Leads
            .AsNoTracking()
            .Include(l => l.AssignedAgent)
            .Include(l => l.AssignedBy)
            .Where(l => l.CompanyId == companyId);

        if (targetIrmId.HasValue)
        {
            leadsQuery = leadsQuery.Where(l => l.AssignedAgentId == targetIrmId.Value);
        }
        else
        {
            // Admin viewing all assigned IRM leads
            leadsQuery = leadsQuery.Where(l => l.AssignedAgentId != null);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            leadsQuery = leadsQuery.Where(l =>
                l.Name.ToLower().Contains(s) ||
                l.Phone.Contains(s) ||
                (l.Email != null && l.Email.ToLower().Contains(s)) ||
                (l.Location != null && l.Location.ToLower().Contains(s)));
        }

        var rawLeads = await leadsQuery
            .OrderByDescending(l => l.AssignedAt ?? l.CreatedAt)
            .ToListAsync(ct);

        // Fetch related contextual datasets to determine current stage
        var pendingFollowups = await _db.Followups
            .AsNoTracking()
            .Where(f => f.CompanyId == companyId && f.Status == FollowupStatus.Pending)
            .Select(f => new { f.ContactId, f.ContactPhone, f.ScheduledAt })
            .ToListAsync(ct);

        var kycRecords = await _db.InvestorKycs
            .AsNoTracking()
            .Where(k => k.CompanyId == companyId)
            .Select(k => new { k.Phone, k.Email, k.InvestorName, Status = k.Status.ToString() })
            .ToListAsync(ct);

        var investors = await _db.Investors
            .AsNoTracking()
            .Where(i => i.CompanyId == companyId)
            .Select(i => new { i.Id, i.Phone, i.Email, i.Name, Status = i.Status.ToString() })
            .ToListAsync(ct);

        var customers = await _db.Customers
            .AsNoTracking()
            .Where(c => c.CompanyId == companyId)
            .Select(c => new { c.Id, c.Phone, c.Email, c.Name })
            .ToListAsync(ct);

        var deals = await _db.GhlDeals
            .AsNoTracking()
            .Include(d => d.Customer)
            .Where(d => d.CompanyId == companyId)
            .Select(d => new { 
                d.CustomerId, 
                d.CustomerName, 
                CustomerPhone = d.Customer != null ? d.Customer.Phone : null,
                CustomerEmail = d.Customer != null ? d.Customer.Email : null,
                d.Stage, 
                d.Value 
            })
            .ToListAsync(ct);

        var items = new List<IrmAllLeadItemDto>();

        foreach (var l in rawLeads)
        {
            var phoneLast10 = GetLast10(l.Phone);
            var leadEmailLower = (l.Email ?? string.Empty).Trim().ToLower();
            var leadNameLower = (l.Name ?? string.Empty).Trim().ToLower();

            // Match customer: prefer phone and email before exact name
            var matchedCustomer = customers.FirstOrDefault(c =>
                (!string.IsNullOrWhiteSpace(phoneLast10) && GetLast10(c.Phone) == phoneLast10) ||
                (!string.IsNullOrWhiteSpace(leadEmailLower) && !string.IsNullOrWhiteSpace(c.Email) && c.Email.Trim().ToLower() == leadEmailLower) ||
                (!string.IsNullOrWhiteSpace(leadNameLower) && c.Name.Trim().ToLower() == leadNameLower));

            // Match investor in portfolio
            var matchedInvestor = investors.FirstOrDefault(i =>
                (!string.IsNullOrWhiteSpace(phoneLast10) && GetLast10(i.Phone) == phoneLast10) ||
                (!string.IsNullOrWhiteSpace(leadEmailLower) && !string.IsNullOrWhiteSpace(i.Email) && i.Email.Trim().ToLower() == leadEmailLower) ||
                (!string.IsNullOrWhiteSpace(leadNameLower) && i.Name.Trim().ToLower() == leadNameLower));

            // 1. Check if Deal/Opportunity exists: prefer customerId first, then normalized phone/email, then exact name
            var matchedDeal = deals.FirstOrDefault(d =>
                (matchedCustomer != null && d.CustomerId == matchedCustomer.Id) ||
                (!string.IsNullOrWhiteSpace(phoneLast10) && GetLast10(d.CustomerPhone) == phoneLast10) ||
                (!string.IsNullOrWhiteSpace(leadEmailLower) && !string.IsNullOrWhiteSpace(d.CustomerEmail) && d.CustomerEmail.Trim().ToLower() == leadEmailLower) ||
                (!string.IsNullOrWhiteSpace(leadNameLower) && d.CustomerName.Trim().ToLower() == leadNameLower));

            // 2. Check if KYC exists: prefer phone and email before exact name
            var matchedKyc = kycRecords.FirstOrDefault(k =>
                (!string.IsNullOrWhiteSpace(phoneLast10) && GetLast10(k.Phone) == phoneLast10) ||
                (!string.IsNullOrWhiteSpace(leadEmailLower) && !string.IsNullOrWhiteSpace(k.Email) && k.Email.Trim().ToLower() == leadEmailLower) ||
                (!string.IsNullOrWhiteSpace(leadNameLower) && k.InvestorName.Trim().ToLower() == leadNameLower));

            // 3. Check if Pending Follow-up exists
            var matchedFollowup = pendingFollowups.FirstOrDefault(f =>
                (f.ContactId != null && f.ContactId == l.Id.ToString()) ||
                (!string.IsNullOrWhiteSpace(phoneLast10) && GetLast10(f.ContactPhone) == phoneLast10));

            string currentStage = "My Leads";
            string stageDetails = "Active assigned lead";
            string? kycStatus = null;
            DateTime? nextFollowup = l.NextFollowupDate;
            decimal? dealValue = null;
            string? dealStage = null;

            if (matchedDeal != null)
            {
                var dStage = (matchedDeal.Stage ?? string.Empty).Trim().ToLowerInvariant();
                dealValue = matchedDeal.Value;
                dealStage = matchedDeal.Stage;

                if (dStage == "qualified_investor" || dStage == "qualified")
                {
                    currentStage = "KYC";
                    kycStatus = matchedKyc?.Status ?? "Verified";
                    stageDetails = $"Deal in 'qualified_investor' stage (KYC: {kycStatus})";
                }
                else if (dStage == "investment_opportunity" || dStage == "opportunity" || dStage == "term_sheet" || dStage == "committed")
                {
                    currentStage = "Opportunities";
                    stageDetails = dealValue.HasValue && dealValue.Value > 0
                        ? $"Active Opportunity (₹{dealValue.Value:N0})"
                        : $"Deal in '{matchedDeal.Stage}' stage";
                }
                else if (dStage == "converted" || dStage == "won")
                {
                    currentStage = "Converted";
                    stageDetails = dealValue.HasValue && dealValue.Value > 0
                        ? $"Converted / Closed Won (₹{dealValue.Value:N0})"
                        : "Deal in 'converted' stage";
                }
                else if (dStage == "lost")
                {
                    currentStage = "Archived";
                    stageDetails = "Deal marked as Lost";
                }
                else if (dStage == "followup")
                {
                    currentStage = "Follow-up";
                    nextFollowup = matchedFollowup?.ScheduledAt ?? l.NextFollowupDate;
                    stageDetails = nextFollowup.HasValue
                        ? $"Follow-up scheduled for {nextFollowup.Value:MMM dd, yyyy}"
                        : "Follow-up pending scheduling";
                }
                else
                {
                    currentStage = "My Leads";
                    stageDetails = $"Deal in '{matchedDeal.Stage}' stage";
                }
            }
            else if (matchedInvestor != null || (matchedKyc != null && matchedKyc.Status.Equals("Approved", StringComparison.OrdinalIgnoreCase)))
            {
                currentStage = "Investor 360";
                kycStatus = "Approved";
                stageDetails = "Active Approved Investor in Portfolio";
            }
            else if (matchedKyc != null || (!string.IsNullOrWhiteSpace(l.CustomFieldsJson) && l.CustomFieldsJson.Contains("kyc", StringComparison.OrdinalIgnoreCase)))
            {
                currentStage = "KYC";
                kycStatus = matchedKyc?.Status ?? "Submitted";
                stageDetails = $"KYC Status: {kycStatus}";
            }
            else if (matchedFollowup != null || l.Status.Equals("Follow-up Required", StringComparison.OrdinalIgnoreCase) || l.Status.Equals("Callback", StringComparison.OrdinalIgnoreCase))
            {
                currentStage = "Follow-up";
                nextFollowup = matchedFollowup?.ScheduledAt ?? l.NextFollowupDate;
                stageDetails = nextFollowup.HasValue
                    ? $"Follow-up scheduled for {nextFollowup.Value:MMM dd, yyyy}"
                    : "Follow-up pending scheduling";
            }
            else if (l.Status.Equals("Converted", StringComparison.OrdinalIgnoreCase))
            {
                currentStage = "Converted";
                stageDetails = "Lead marked as Converted";
            }
            else if (l.Status.Equals("Not Interested", StringComparison.OrdinalIgnoreCase) ||
                     l.Status.Equals("Junk", StringComparison.OrdinalIgnoreCase))
            {
                currentStage = "Archived";
                stageDetails = $"Status marked as '{l.Status}'";
            }
            else
            {
                currentStage = "My Leads";
                stageDetails = "In initial review / Interested";
            }

            // Extract investment fields from CustomFieldsJson if present
            string? investmentCapacity = null;
            string? preferredAssetClass = null;
            if (!string.IsNullOrWhiteSpace(l.CustomFieldsJson))
            {
                try
                {
                    using var doc = JsonDocument.Parse(l.CustomFieldsJson);
                    if (doc.RootElement.TryGetProperty("investmentCapacity", out var capProp))
                        investmentCapacity = capProp.GetString();
                    if (doc.RootElement.TryGetProperty("preferredAssetClass", out var assetProp))
                        preferredAssetClass = assetProp.GetString();
                }
                catch { }
            }

            var item = new IrmAllLeadItemDto
            {
                Id = l.Id,
                CompanyId = l.CompanyId,
                Name = l.Name,
                Phone = l.Phone,
                Email = l.Email,
                Location = l.Location,
                Source = l.Source,
                Status = l.Status,
                Priority = l.Priority,
                Notes = l.Notes,
                AssignedAgentId = l.AssignedAgentId,
                AssignedAgentName = l.AssignedAgent?.Name ?? "Assigned IRM",
                AssignedById = l.AssignedById,
                AssignedByName = (l.AssignedBy != null && l.AssignedById != l.AssignedAgentId)
                    ? l.AssignedBy.Name
                    : "Created by IRM",
                AssignedAt = l.AssignedAt,
                CreatedAt = l.CreatedAt,
                UpdatedAt = l.UpdatedAt,
                CurrentStage = currentStage,
                StageDetails = stageDetails,
                KycStatus = kycStatus,
                NextFollowupDate = nextFollowup,
                DealValue = dealValue,
                DealStage = dealStage,
                InvestmentCapacity = investmentCapacity,
                PreferredAssetClass = preferredAssetClass,
            };

            items.Add(item);
        }

        // Summary counts
        var total = items.Count;
        var inMyLeads = items.Count(i => i.CurrentStage == "My Leads");
        var inFollowup = items.Count(i => i.CurrentStage == "Follow-up");
        var inKyc = items.Count(i => i.CurrentStage == "KYC");
        var inOpps = items.Count(i => i.CurrentStage == "Opportunities");
        var converted = items.Count(i => i.CurrentStage == "Converted" || i.Status.Equals("Converted", StringComparison.OrdinalIgnoreCase));

        // Filter by stage if requested
        if (!string.IsNullOrWhiteSpace(stage) && !stage.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            items = items.Where(i => i.CurrentStage.Equals(stage, StringComparison.OrdinalIgnoreCase)).ToList();
        }

        // Apply pagination if requested
        if (page.HasValue && page.Value > 0 && pageSize.HasValue && pageSize.Value > 0)
        {
            var p = page.Value;
            var ps = Math.Min(pageSize.Value, 200);
            items = items.Skip((p - 1) * ps).Take(ps).ToList();
        }

        var result = new IrmAllLeadsSummaryDto
        {
            TotalAssignedLeads = total,
            InMyLeads = inMyLeads,
            InFollowup = inFollowup,
            InKyc = inKyc,
            InOpportunities = inOpps,
            Converted = converted,
            Leads = items,
        };

        return Ok(ApiResponse<IrmAllLeadsSummaryDto>.SuccessResult(result, "All assigned leads retrieved successfully."));
    }
}
