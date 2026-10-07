using backend.Authentication.Interfaces;
using backend.Configuration;
using backend.Data;
using backend.DTOs.Calls;
using backend.DTOs.Common;
using backend.Extensions;
using backend.Models.Entities;
using backend.Services.Implementations;
using backend.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace backend.Controllers.SalesExecutive;

[ApiController]
[Route("api/sales-executive/calls")]
[Authorize(Roles = "sales_executive,company_admin,super_admin,irm,admin,ghl_admin")]
public class SalesExecutiveCallsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;
    private readonly ICallService _callService;
    private readonly IEmailService _emailService;
    private readonly IOptions<TwilioSettings> _twilioOptions;

    public SalesExecutiveCallsController(
        ApplicationDbContext context, 
        ICurrentUserService currentUser,
        ICallService callService,
        IEmailService emailService,
        IOptions<TwilioSettings> twilioOptions)
    {
        _context = context;
        _currentUser = currentUser;
        _callService = callService;
        _emailService = emailService;
        _twilioOptions = twilioOptions;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResult<CallRecordResponseDto>>>> GetCalls(
        [FromQuery] string? search,
        [FromQuery] string? direction,
        [FromQuery] string? disposition,
        [FromQuery] int? leadId,
        [FromQuery] int? customerId,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var role = (_currentUser.Role ?? string.Empty).ToLowerInvariant();
        var agentId = _currentUser.UserId;
        var companyId = _currentUser.CompanyId;

        var query = _context.CallRecords.AsNoTracking()
            .Include(c => c.Agent)
                .ThenInclude(a => a!.Role)
            .AsQueryable();

        if (role != "super_admin" && companyId.HasValue)
        {
            query = query.Where(c => c.CompanyId == companyId.Value);
        }

        if ((role == "sales_executive" || role == "irm") && agentId.HasValue)
        {
            query = query.Where(c => c.AgentId == agentId.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(c => c.ContactName.ToLower().Contains(s) || c.ContactPhone.Contains(s) || (c.Notes != null && c.Notes.ToLower().Contains(s)));
        }

        if (!string.IsNullOrWhiteSpace(direction))
        {
            var d = direction.Trim().ToLower();
            query = query.Where(c => c.Direction == d);
        }

        if (!string.IsNullOrWhiteSpace(disposition))
        {
            query = query.Where(c => c.Disposition == disposition);
        }

        if (leadId.HasValue)
        {
            query = query.Where(c => c.LeadId == leadId.Value);
        }

        if (customerId.HasValue)
        {
            query = query.Where(c => c.CustomerId == customerId.Value);
        }

        if (from.HasValue)
        {
            query = query.Where(c => c.Timestamp >= from.Value.ToUniversalTime());
        }

        if (to.HasValue)
        {
            query = query.Where(c => c.Timestamp <= to.Value.ToUniversalTime());
        }

        var totalCount = await query.CountAsync(ct);

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var rawItems = await query
            .OrderByDescending(c => c.Timestamp)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        Dictionary<int, Role>? rolesDict = null;
        try
        {
            rolesDict = await _context.Roles.AsNoTracking().ToDictionaryAsync(r => r.Id, r => r, ct);
        }
        catch
        {
            // Fallback for tests if Roles table is unseeded
        }

        var items = rawItems.Select(c => MapToResponseDto(c, rolesDict)).ToList();

        return Ok(ApiResponse<PagedResult<CallRecordResponseDto>>.SuccessResult(
            PagedResult<CallRecordResponseDto>.Create(items, totalCount, page, pageSize),
            "Call records retrieved successfully."));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ApiResponse<CallRecordResponseDto>>> GetCallById(
        int id,
        CancellationToken ct = default)
    {
        var role = (_currentUser.Role ?? string.Empty).ToLowerInvariant();
        var agentId = _currentUser.UserId;
        var companyId = _currentUser.CompanyId;

        var call = await _context.CallRecords.AsNoTracking()
            .Include(c => c.Agent)
                .ThenInclude(a => a!.Role)
            .FirstOrDefaultAsync(c => c.Id == id, ct);

        if (call == null)
        {
            return NotFound(ApiResponse<CallRecordResponseDto>.FailureResult("Call record not found."));
        }

        if (role != "super_admin" && companyId.HasValue && call.CompanyId != companyId.Value)
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<CallRecordResponseDto>.FailureResult("Access denied: You cannot access calls from another company."));
        }

        if ((role == "sales_executive" || role == "irm") && agentId.HasValue && call.AgentId != agentId.Value)
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<CallRecordResponseDto>.FailureResult("Access denied: You are only authorized to view your own call records."));
        }

        Role? agentRoleEntity = null;
        if (call.Agent != null && call.Agent.RoleId > 0)
        {
            try
            {
                agentRoleEntity = await _context.Roles.AsNoTracking().FirstOrDefaultAsync(r => r.Id == call.Agent.RoleId, ct);
            }
            catch {}
        }

        var dto = MapToResponseDto(call, agentRoleEntity != null ? new Dictionary<int, Role> { { agentRoleEntity.Id, agentRoleEntity } } : null);

        return Ok(ApiResponse<CallRecordResponseDto>.SuccessResult(dto, "Call record retrieved successfully."));
    }

    [HttpGet("carrier-status")]
    public async Task<ActionResult<ApiResponse<object>>> GetCarrierStatus(CancellationToken ct = default)
    {
        var twilioConfigured = _twilioOptions.Value.IsConfigured;
        var carrier = await _context.CarrierSettings.AsNoTracking().FirstOrDefaultAsync(ct);
        var carrierConfigured = carrier != null && 
            !string.IsNullOrWhiteSpace(carrier.AccountSid) && 
            !string.IsNullOrWhiteSpace(carrier.AuthTokenEncrypted) &&
            carrier.Status == "Active";

        var isConfigured = twilioConfigured || carrierConfigured;
        var primaryCarrier = twilioConfigured ? "Twilio Programmable Voice" : (carrier?.PrimaryCarrier ?? "None");

        return Ok(ApiResponse<object>.SuccessResult(new
        {
            isConfigured,
            primaryCarrier,
            status = isConfigured ? "Connected" : "Not Configured / Unavailable",
            message = isConfigured 
                ? (twilioConfigured ? "Twilio Programmable Voice connected." : "Carrier trunk connected.") 
                : "No active carrier trunk (Twilio / Exotel) credentials configured on the backend server. Live telephony calls unavailable."
        }, "Carrier status retrieved."));
    }

    private static CallRecordResponseDto MapToResponseDto(CallRecord c, Dictionary<int, Role>? rolesDict = null)
    {
        Role? agentRoleObj = null;
        if (c.Agent != null)
        {
            if (rolesDict != null && rolesDict.TryGetValue(c.Agent.RoleId, out var r))
            {
                agentRoleObj = r;
            }
            else
            {
                agentRoleObj = c.Agent.Role;
            }
        }

        var roleCode = agentRoleObj?.Code?.ToLowerInvariant();
        var roleName = agentRoleObj?.Name?.ToLowerInvariant();
        var notes = c.Notes ?? string.Empty;

        // Categorize using the call's stored source, role of agent, and explicit markers
        var isIrm = roleCode == "irm"
            || (c.Agent != null && c.Agent.RoleId == 4)
            || (roleName != null && (roleName.Contains("irm") || roleName.Contains("investor relations")))
            || notes.Contains("Connect via IRM", StringComparison.OrdinalIgnoreCase)
            || notes.Contains("Connected to IRM", StringComparison.OrdinalIgnoreCase)
            || notes.Contains("[Source: irm]", StringComparison.OrdinalIgnoreCase);

        var callerType = isIrm ? "IRM" : "Agent";
        var agentRole = isIrm ? "IRM" : "Agent";
        var connectVia = isIrm ? "Connect via IRM" : "Connect via Agent";
        var source = isIrm ? "irm" : "agent";

        return new CallRecordResponseDto
        {
            Id = c.Id,
            CompanyId = c.CompanyId,
            AgentId = c.AgentId,
            AgentName = c.Agent?.Name,
            AgentRole = agentRole,
            CallerType = callerType,
            ConnectVia = connectVia,
            Source = source,
            ContactName = c.ContactName,
            ContactPhone = c.ContactPhone,
            Direction = c.Direction,
            Duration = c.Duration,
            Disposition = c.Disposition,
            Notes = c.Notes,
            Reason = c.Reason,
            CallModule = c.CallModule,
            LeadId = c.LeadId,
            CustomerId = c.CustomerId,
            Timestamp = c.Timestamp,
            CreatedAt = c.CreatedAt,
            RecordingUrl = c.RecordingUrl,
            Transcript = c.Transcript,
            TwilioCallSid = c.TwilioCallSid
        };
    }

    [HttpGet("messaging-channels")]
    public ActionResult<ApiResponse<List<MessagingChannelStatusDto>>> GetMessagingChannels()
    {
        var channels = new List<MessagingChannelStatusDto>
        {
            new MessagingChannelStatusDto
            {
                Channel = "email",
                Name = "Email",
                Configured = true,
                Provider = "SMTP (smtp.gmail.com)",
                StatusMessage = "Active and configured via Gmail SMTP."
            },
            new MessagingChannelStatusDto
            {
                Channel = "sms",
                Name = "SMS",
                Configured = false,
                Provider = "None",
                StatusMessage = "No SMS gateway provider (e.g., Twilio / AWS SNS) is configured on the backend server."
            },
            new MessagingChannelStatusDto
            {
                Channel = "whatsapp",
                Name = "WhatsApp",
                Configured = false,
                Provider = "None",
                StatusMessage = "No WhatsApp Business API provider is configured on the backend server."
            }
        };

        return Ok(ApiResponse<List<MessagingChannelStatusDto>>.SuccessResult(channels, "Messaging channels retrieved."));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<CallRecordResponseDto>>> LogCall(
        [FromBody] LogCallDto dto,
        CancellationToken ct = default)
    {
        var role = (_currentUser.Role ?? string.Empty).ToLowerInvariant();
        if (User.IsGhlAdmin() || role == "ghl_admin")
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<CallRecordResponseDto>.FailureResult("Access denied: GHL Admin has read-only access to IRM call records."));
        }

        var agentId = _currentUser.UserId;
        if (!agentId.HasValue || agentId.Value <= 0)
            return Unauthorized(ApiResponse<CallRecordResponseDto>.FailureResult("Unauthorized: User ID is missing."));

        var companyId = _currentUser.CompanyId;
        if (!companyId.HasValue || companyId.Value <= 0)
            return Unauthorized(ApiResponse<CallRecordResponseDto>.FailureResult("Unauthorized: Company ID is missing."));

        var normalizedModule = IrmOtherService.NormalizeModule(dto.Module);
        if (!string.IsNullOrWhiteSpace(dto.Module) || role == "irm")
        {
            if (!string.IsNullOrWhiteSpace(normalizedModule))
            {
                if (!IrmOtherService.ModuleOutcomes.TryGetValue(normalizedModule, out var allowedOutcomes))
                {
                    return BadRequest(ApiResponse<CallRecordResponseDto>.FailureResult($"Invalid module '{dto.Module}'. Allowed IRM modules are: my_leads, follow_up, kyc, opportunities, investor_360."));
                }

                var dispo = dto.Disposition?.Trim() ?? string.Empty;
                if (!allowedOutcomes.Any(o => o.Equals(dispo, StringComparison.OrdinalIgnoreCase)))
                {
                    return BadRequest(ApiResponse<CallRecordResponseDto>.FailureResult($"Disposition '{dto.Disposition}' is not valid for module '{dto.Module}'."));
                }
            }

            if (dto.Disposition != null && dto.Disposition.Trim().Equals("Other", StringComparison.OrdinalIgnoreCase))
            {
                var effectiveReason = (dto.Reason ?? dto.Notes)?.Trim();
                if (string.IsNullOrWhiteSpace(effectiveReason))
                {
                    return BadRequest(ApiResponse<CallRecordResponseDto>.FailureResult("Reason is required when disposition is Other."));
                }
            }
        }

        // Use actual provider results; do not mark simulated calls as connected or successful
        var hasTwilioSid = !string.IsNullOrWhiteSpace(dto.TwilioCallSid);
        var twilioConfigured = _twilioOptions.Value.IsConfigured;
        var carrier = await _context.CarrierSettings.AsNoTracking().FirstOrDefaultAsync(ct);
        var hasCarrier = carrier != null && 
            !string.IsNullOrWhiteSpace(carrier.AccountSid) && 
            !string.IsNullOrWhiteSpace(carrier.AuthTokenEncrypted) &&
            carrier.Status == "Active";

        var isSimulated = !hasTwilioSid && (!twilioConfigured && !hasCarrier || (dto.Notes != null && dto.Notes.Contains("Simulated", StringComparison.OrdinalIgnoreCase)));
        var effectiveDuration = isSimulated ? 0 : dto.Duration;
        var rawNotes = dto.Notes?.Trim() ?? string.Empty;

        var effectiveDisposition = dto.Disposition.Trim();
        if (isSimulated && (effectiveDisposition == "Interested" || effectiveDisposition == "Converted"))
        {
            effectiveDisposition = "No Response";
            if (!rawNotes.Contains("Simulated", StringComparison.OrdinalIgnoreCase))
            {
                rawNotes = string.IsNullOrWhiteSpace(rawNotes)
                    ? "[Provider Result: Simulated / Telephony Gateway Offline - Call not connected]"
                    : $"{rawNotes}\n[Provider Result: Simulated / Telephony Gateway Offline - Call not connected]";
            }
        }
        else if (isSimulated && !rawNotes.Contains("Simulated", StringComparison.OrdinalIgnoreCase))
        {
            rawNotes = string.IsNullOrWhiteSpace(rawNotes)
                ? "[Provider Result: Simulated / Carrier Not Connected]"
                : $"{rawNotes}\n[Provider Result: Simulated / Carrier Not Connected]";
        }

        if (role == "irm" && !rawNotes.Contains("[Source: irm]", StringComparison.OrdinalIgnoreCase))
        {
            rawNotes = $"{rawNotes} [Source: irm]".Trim();
        }

        string? storedReason = null;
        if (!string.IsNullOrWhiteSpace(dto.Reason))
        {
            storedReason = dto.Reason.Trim();
        }
        else if (dto.Disposition != null && (dto.Disposition.Trim().Equals("Other", StringComparison.OrdinalIgnoreCase) || dto.Disposition.Trim().Equals("Contacted", StringComparison.OrdinalIgnoreCase)))
        {
            storedReason = string.IsNullOrWhiteSpace(dto.Notes) ? null : dto.Notes.Trim();
        }

        int? validLeadId = dto.LeadId;
        if (validLeadId.HasValue)
        {
            if (validLeadId.Value <= 0)
            {
                validLeadId = null;
            }
            else if (!_context.Database.IsInMemory())
            {
                var leadExists = await _context.Leads.AnyAsync(l => l.Id == validLeadId.Value, ct);
                if (!leadExists) validLeadId = null;
            }
        }

        int? validCustomerId = dto.CustomerId;
        if (validCustomerId.HasValue)
        {
            if (validCustomerId.Value <= 0)
            {
                validCustomerId = null;
            }
            else if (!_context.Database.IsInMemory())
            {
                var customerExists = await _context.Customers.AnyAsync(c => c.Id == validCustomerId.Value, ct);
                if (!customerExists) validCustomerId = null;
            }
        }

        var call = new CallRecord
        {
            CompanyId = companyId.Value,
            AgentId = agentId.Value,
            ContactName = dto.ContactName.Trim(),
            ContactPhone = dto.ContactPhone.Trim(),
            Direction = string.IsNullOrWhiteSpace(dto.Direction) ? "outbound" : dto.Direction.Trim().ToLower(),
            Duration = effectiveDuration,
            Disposition = effectiveDisposition,
            Notes = rawNotes,
            Reason = storedReason,
            CallModule = normalizedModule,
            LeadId = validLeadId,
            CustomerId = validCustomerId,
            TwilioCallSid = dto.TwilioCallSid,
            Timestamp = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        };

        _context.CallRecords.Add(call);
        await _context.SaveChangesAsync(ct);

        try
        {
            await _context.Entry(call).Reference(c => c.Agent).Query().Include(a => a.Role).LoadAsync(ct);
        }
        catch
        {
            // Suppress if navigation is already loaded or in test contexts
        }

        var response = MapToResponseDto(call);

        return Ok(ApiResponse<CallRecordResponseDto>.SuccessResult(response, "Call record logged successfully."));
    }

    [HttpPost("disposition")]
    public async Task<ActionResult<ApiResponse<CallRecordDto>>> ProcessDisposition(
        [FromBody] CallDispositionDto request,
        CancellationToken ct = default)
    {
        var role = (_currentUser.Role ?? string.Empty).ToLowerInvariant();
        if (User.IsGhlAdmin() || role == "ghl_admin")
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<CallRecordDto>.FailureResult("Access denied: GHL Admin has read-only access to call disposition records."));
        }

        var normalizedModule = IrmOtherService.NormalizeModule(request.Module);
        if (!string.IsNullOrWhiteSpace(request.Module) || role == "irm")
        {
            if (!string.IsNullOrWhiteSpace(normalizedModule))
            {
                if (!IrmOtherService.ModuleOutcomes.TryGetValue(normalizedModule, out var allowedOutcomes))
                {
                    return BadRequest(ApiResponse<CallRecordDto>.FailureResult($"Invalid module '{request.Module}'. Allowed IRM modules are: my_leads, follow_up, kyc, opportunities, investor_360."));
                }

                var dispo = request.Disposition?.Trim() ?? string.Empty;
                if (!allowedOutcomes.Any(o => o.Equals(dispo, StringComparison.OrdinalIgnoreCase)))
                {
                    return BadRequest(ApiResponse<CallRecordDto>.FailureResult($"Disposition '{request.Disposition}' is not valid for module '{request.Module}'."));
                }
            }

            if (request.Disposition != null && request.Disposition.Trim().Equals("Other", StringComparison.OrdinalIgnoreCase))
            {
                var effectiveReason = (request.Reason ?? request.Notes)?.Trim();
                if (string.IsNullOrWhiteSpace(effectiveReason))
                {
                    return BadRequest(ApiResponse<CallRecordDto>.FailureResult("Reason is required when disposition is Other."));
                }
            }
        }

        var result = await _callService.ProcessDispositionAsync(request, ct);
        if (!result.Success)
        {
            if (result.Message.StartsWith("Unauthorized"))
                return Unauthorized(result);
            return BadRequest(result);
        }
        return Ok(result);
    }

    [HttpGet("other")]
    public async Task<IActionResult> GetOtherRecords(
        [FromServices] IIrmOtherService otherService,
        [FromQuery] string? module,
        [FromQuery] string? search,
        [FromQuery] int? irmId,
        CancellationToken ct = default)
    {
        var companyId = _currentUser.CompanyId ?? User.GetCompanyId();
        var role = (_currentUser.Role ?? User.GetUserRole()).ToLowerInvariant();
        int? effectiveIrmId = (role == "irm") ? (_currentUser.UserId ?? User.GetUserId()) : irmId;

        var result = await otherService.GetOtherRecordsAsync(companyId, effectiveIrmId, module, search, ct);
        return Ok(result);
    }

    [HttpGet("outcomes")]
    [HttpGet("call-outcomes")]
    public IActionResult GetCallOutcomes(
        [FromServices] IIrmOtherService otherService,
        [FromQuery] string? module)
    {
        var result = otherService.GetCallOutcomes();
        if (!string.IsNullOrWhiteSpace(module))
        {
            var normalized = IrmOtherService.NormalizeModule(module);
            if (normalized != null && result.Data != null && result.Data.TryGetValue(normalized, out var list))
            {
                return Ok(ApiResponse<List<string>>.SuccessResponse(list, $"Call outcomes for module {normalized} retrieved."));
            }
        }
        return Ok(result);
    }

    [HttpPost("send-customer-message")]
    public async Task<ActionResult<ApiResponse<SendCustomerMessageResponseDto>>> SendCustomerMessage(
        [FromBody] SendCustomerMessageRequestDto dto,
        CancellationToken ct = default)
    {
        var role = (_currentUser.Role ?? string.Empty).ToLowerInvariant();
        if (User.IsGhlAdmin() || role == "ghl_admin")
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<SendCustomerMessageResponseDto>.FailureResult("Access denied: GHL Admin has read-only access to customer messaging records."));
        }

        var agentId = _currentUser.UserId;
        if (!agentId.HasValue || agentId.Value <= 0)
            return Unauthorized(ApiResponse<SendCustomerMessageResponseDto>.FailureResult("Unauthorized: User ID is missing."));

        var companyId = _currentUser.CompanyId;
        if (!companyId.HasValue || companyId.Value <= 0)
            return Unauthorized(ApiResponse<SendCustomerMessageResponseDto>.FailureResult("Unauthorized: Company ID is missing."));

        var user = await _context.Users.FindAsync(new object[] { agentId.Value }, ct);
        var senderName = user?.Name ?? "IRM Advisor";
        var senderRole = _currentUser.Role == "irm" ? "Investor Relations Manager" : (_currentUser.Role ?? "Sales Executive");

        var channel = string.IsNullOrWhiteSpace(dto.Channel) ? "email" : dto.Channel.Trim().ToLowerInvariant();

        var recipientEmail = dto.RecipientEmail?.Trim();
        var recipientPhone = dto.RecipientPhone?.Trim();

        // If contact details not provided in DTO, attempt lookup via CustomerId or LeadId
        if (string.IsNullOrWhiteSpace(recipientEmail) || string.IsNullOrWhiteSpace(recipientPhone))
        {
            if (dto.CustomerId.HasValue)
            {
                var customer = await _context.Customers.FindAsync(new object[] { dto.CustomerId.Value }, ct);
                if (customer != null)
                {
                    if (string.IsNullOrWhiteSpace(recipientEmail) && !string.IsNullOrWhiteSpace(customer.Email))
                    {
                        recipientEmail = customer.Email.Trim();
                    }
                    if (string.IsNullOrWhiteSpace(recipientPhone) && !string.IsNullOrWhiteSpace(customer.Phone))
                    {
                        recipientPhone = customer.Phone.Trim();
                    }
                }
            }
            if (dto.LeadId.HasValue)
            {
                var lead = await _context.Leads.FindAsync(new object[] { dto.LeadId.Value }, ct);
                if (lead != null)
                {
                    if (string.IsNullOrWhiteSpace(recipientEmail) && !string.IsNullOrWhiteSpace(lead.Email))
                    {
                        recipientEmail = lead.Email.Trim();
                    }
                    if (string.IsNullOrWhiteSpace(recipientPhone) && !string.IsNullOrWhiteSpace(lead.Phone))
                    {
                        recipientPhone = lead.Phone.Trim();
                    }
                }
            }
        }

        bool delivered = false;
        string deliveryResult;
        string? effectiveRecipient = null;

        // Channel-specific processing and provider verification
        if (channel == "email")
        {
            effectiveRecipient = recipientEmail;
            if (string.IsNullOrWhiteSpace(recipientEmail))
            {
                delivered = false;
                deliveryResult = "Message delivery unavailable: No email address on file for this contact. SMS and WhatsApp gateways are not configured on the server.";
            }
            else if (!recipientEmail.Contains('@') || !recipientEmail.Contains('.'))
            {
                delivered = false;
                deliveryResult = $"Message delivery failed: '{recipientEmail}' is not a valid email address.";
            }
            else
            {
                var recipientDisplayName = string.IsNullOrWhiteSpace(dto.RecipientName) ? "Valued Client" : dto.RecipientName.Trim();
                var subject = $"Follow-up from GHL India Ventures - {recipientDisplayName}";
                var encodedBody = System.Net.WebUtility.HtmlEncode(dto.Message).Replace("\n", "<br/>");

                var htmlContent = $@"
<!DOCTYPE html>
<html>
<body style=""font-family: Arial, sans-serif; background-color: #f8fafc; padding: 24px; color: #1e293b;"">
  <div style=""max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;"">
    <div style=""background: #0f172a; padding: 20px 24px; border-bottom: 3px solid #0284c7;"">
      <h2 style=""margin: 0; color: #ffffff; font-size: 18px;"">GHL India Ventures</h2>
      <p style=""margin: 4px 0 0; color: #94a3b8; font-size: 12px;"">Institutional Wealth & Investor Relations</p>
    </div>
    <div style=""padding: 24px; line-height: 1.6; font-size: 14px;"">
      <p style=""margin-top: 0;"">Dear {recipientDisplayName},</p>
      <div style=""background: #f1f5f9; padding: 16px; border-radius: 6px; border-left: 4px solid #0284c7; margin: 16px 0;"">
        {encodedBody}
      </div>
      <p style=""margin-bottom: 0; color: #64748b; font-size: 13px;"">
        If you have any questions or wish to reschedule our discussion, please reply directly to this email.
      </p>
    </div>
    <div style=""padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;"">
      <strong>{senderName}</strong><br/>
      {senderRole} • GHL India Ventures
    </div>
  </div>
</body>
</html>";

                var sendOk = await _emailService.SendEmailAsync(recipientEmail, subject, htmlContent, ct);
                if (sendOk)
                {
                    delivered = true;
                    deliveryResult = $"Delivered successfully to {recipientEmail} via Email (SMTP)";
                }
                else
                {
                    delivered = false;
                    deliveryResult = $"Email dispatch failed: {_emailService.LastError ?? "SMTP server connection error"}";
                }
            }
        }
        else if (channel == "sms")
        {
            effectiveRecipient = recipientPhone;
            if (string.IsNullOrWhiteSpace(recipientPhone))
            {
                delivered = false;
                deliveryResult = "SMS delivery unavailable: No phone number on file for this contact.";
            }
            else
            {
                // SMS gateway (Twilio, AWS SNS, Msg91) is not configured in backend settings
                delivered = false;
                deliveryResult = $"SMS delivery unavailable: No SMS gateway provider is configured on the backend server to deliver to {recipientPhone}.";
            }
        }
        else if (channel == "whatsapp")
        {
            effectiveRecipient = recipientPhone;
            if (string.IsNullOrWhiteSpace(recipientPhone))
            {
                delivered = false;
                deliveryResult = "WhatsApp delivery unavailable: No phone number on file for this contact.";
            }
            else
            {
                // WhatsApp Business API provider is not configured in backend settings
                delivered = false;
                deliveryResult = $"WhatsApp delivery unavailable: No WhatsApp Business API provider is configured on the backend server to deliver to {recipientPhone}.";
            }
        }
        else
        {
            delivered = false;
            deliveryResult = $"Message delivery failed: Unsupported channel '{channel}'.";
        }

        // Record communication activity in Customer and/or Lead notes & deals, attributed to signed-in IRM
        var activityTimestamp = DateTime.UtcNow;
        var channelTag = channel.ToUpperInvariant();
        var activityLogSnippet = $"[{activityTimestamp:yyyy-MM-dd HH:mm:ss} UTC] [No Response Follow-up Message via {channelTag} - {(delivered ? "Delivered" : "Delivery Failed")}] By {senderName} ({senderRole}):\nRecipient: {effectiveRecipient ?? "None"}\nMessage: {dto.Message}\nStatus: {deliveryResult}";

        if (dto.CustomerId.HasValue)
        {
            var customer = await _context.Customers.FindAsync(new object[] { dto.CustomerId.Value }, ct);
            if (customer != null)
            {
                customer.Notes = string.IsNullOrWhiteSpace(customer.Notes)
                    ? activityLogSnippet
                    : $"{customer.Notes}\n\n{activityLogSnippet}";
                customer.LastContactedAt = activityTimestamp;
            }
        }

        if (dto.LeadId.HasValue)
        {
            var lead = await _context.Leads.FindAsync(new object[] { dto.LeadId.Value }, ct);
            if (lead != null)
            {
                lead.Notes = string.IsNullOrWhiteSpace(lead.Notes)
                    ? activityLogSnippet
                    : $"{lead.Notes}\n\n{activityLogSnippet}";
            }
        }

        // If deal is referenced or identifiable, record GhlDealActivity
        GhlDeal? deal = null;
        if (dto.DealId.HasValue)
        {
            deal = await _context.GhlDeals.FindAsync(new object[] { dto.DealId.Value }, ct);
        }
        else if (dto.CustomerId.HasValue)
        {
            deal = await _context.GhlDeals
                .Where(d => d.CompanyId == companyId.Value && d.CustomerId == dto.CustomerId.Value)
                .OrderByDescending(d => d.CreatedAt)
                .FirstOrDefaultAsync(ct);
        }

        if (deal != null)
        {
            _context.GhlDealActivities.Add(new GhlDealActivity
            {
                DealId = deal.Id,
                CompanyId = companyId.Value,
                Type = channel,
                Text = $"[No Response Message ({channelTag}) - {(delivered ? "Sent" : "Failed")} to {effectiveRecipient}]: {dto.Message} (Result: {deliveryResult})",
                LoggedByName = senderName,
                LoggedByRole = senderRole,
                Timestamp = activityTimestamp,
                CreatedAt = activityTimestamp
            });
        }

        await _context.SaveChangesAsync(ct);

        var response = new SendCustomerMessageResponseDto
        {
            Success = delivered,
            Delivered = delivered,
            Channel = channel,
            Recipient = effectiveRecipient,
            Message = dto.Message,
            DeliveryResult = deliveryResult,
            SentAt = activityTimestamp,
            SentByName = senderName,
            SentByRole = senderRole
        };

        if (!delivered)
        {
            return Ok(ApiResponse<SendCustomerMessageResponseDto>.FailureResult(
                deliveryResult,
                response));
        }

        return Ok(ApiResponse<SendCustomerMessageResponseDto>.SuccessResult(
            response, 
            "Customer message dispatched successfully."));
    }
}
