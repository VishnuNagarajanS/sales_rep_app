using backend.Data;
using backend.DTOs.Admin;
using backend.DTOs.Common;
using backend.Models.Entities;
using backend.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using BCrypt.Net;

namespace backend.Services.Implementations;

public class AdminUserService : IAdminUserService
{
    private readonly ApplicationDbContext _context;
    private readonly backend.Services.Email.IEmailService _emailService;
    private readonly backend.Services.Interfaces.ICompanyClock _clock;
    private readonly Microsoft.AspNetCore.SignalR.IHubContext<backend.Hubs.PlatformHub, backend.Hubs.IPlatformHubClient>? _hubContext;

    public AdminUserService(
        ApplicationDbContext context,
        backend.Services.Email.IEmailService emailService,
        backend.Services.Interfaces.ICompanyClock clock,
        Microsoft.AspNetCore.SignalR.IHubContext<backend.Hubs.PlatformHub, backend.Hubs.IPlatformHubClient>? hubContext = null)
    {
        _context = context;
        _emailService = emailService;
        _clock = clock;
        _hubContext = hubContext;
    }

    public async Task<ApiResponse<List<AdminUserDto>>> GetUsersByCompanyAsync(int companyId, CancellationToken cancellationToken = default)
    {
        var users = await _context.Users
            .Include(u => u.Role)
            .Where(u => u.CompanyId == companyId)
            .ToListAsync(cancellationToken);

        var today = await _clock.GetCompanyTodayAsync(companyId, cancellationToken);

        var activeHandovers = await _context.WorkHandovers
            .Include(wh => wh.CoveringUser)
            .Where(wh => wh.CompanyId == companyId && wh.Status == "active")
            .ToListAsync(cancellationToken);

        var approvedLeaves = await _context.LeaveRequests
            .Where(lr => lr.CompanyId == companyId && lr.Status == "Approved" && lr.StartDate <= today && today <= lr.EndDate)
            .ToListAsync(cancellationToken);

        var dtos = users.Select(u =>
        {
            var handover = activeHandovers.FirstOrDefault(wh => wh.OriginalUserId == u.Id);
            var leave = approvedLeaves.FirstOrDefault(lr => lr.UserId == u.Id);

            return new AdminUserDto
            {
                Id = u.Id,
                Name = u.Name,
                Email = u.Email,
                Phone = u.Phone,
                RoleId = u.RoleId,
                RoleName = u.Role != null ? u.Role.Name : "Unknown",
                RoleCode = u.Role != null ? u.Role.Code : "sales_executive",
                Status = u.Status,
                LastLoginAt = u.LastLoginAt,
                AvatarUrl = u.AvatarUrl,
                CreatedAt = u.CreatedAt,
                IsCovered = handover != null,
                CoveredBy = handover?.CoveringUser?.Name,
                OnLeave = leave != null,
                LeaveUntil = leave?.EndDate
            };
        }).ToList();

        return ApiResponse<List<AdminUserDto>>.SuccessResult(dtos);
    }

    public async Task<ApiResponse<AdminUserDto>> GetUserByIdAsync(int companyId, int userId, CancellationToken cancellationToken = default)
    {
        var user = await _context.Users
            .Include(u => u.Role)
            .Where(u => u.CompanyId == companyId && u.Id == userId)
            .Select(u => new AdminUserDto
            {
                Id = u.Id,
                Name = u.Name,
                Email = u.Email,
                Phone = u.Phone,
                RoleId = u.RoleId,
                RoleName = u.Role != null ? u.Role.Name : "Unknown",
                RoleCode = u.Role != null ? u.Role.Code : "sales_executive",
                Status = u.Status,
                LastLoginAt = u.LastLoginAt,
                AvatarUrl = u.AvatarUrl,
                CreatedAt = u.CreatedAt,
                IsCovered = _context.WorkHandovers.Any(wh => wh.OriginalUserId == u.Id && wh.Status == "active")
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (user == null)
            return ApiResponse<AdminUserDto>.FailureResult("User not found.");

        return ApiResponse<AdminUserDto>.SuccessResult(user);
    }

    public async Task<ApiResponse<AdminUserDto>> CreateUserAsync(int companyId, CreateUserRequestDto request, CancellationToken cancellationToken = default)
    {
        // Check if email already exists
        if (await _context.Users.AnyAsync(u => u.Email == request.Email, cancellationToken))
        {
            return ApiResponse<AdminUserDto>.FailureResult("Email is already registered.");
        }

        // Check if role exists
        var role = await _context.Roles.FindAsync(new object[] { request.RoleId }, cancellationToken);
        if (role == null)
        {
            return ApiResponse<AdminUserDto>.FailureResult("Invalid Role ID.");
        }

        var passwordToHash = !string.IsNullOrWhiteSpace(request.Password) ? request.Password : "Password@123";

        var newUser = new User
        {
            Name = request.Name.Trim(),
            Email = request.Email.Trim().ToLower(),
            Phone = request.Phone?.Trim() ?? string.Empty,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(passwordToHash),
            RoleId = request.RoleId,
            CompanyId = companyId,
            Status = request.Status,
            CreatedAt = DateTime.UtcNow
        };

        _context.Users.Add(newUser);
        await _context.SaveChangesAsync(cancellationToken);

        bool emailSent = request.Status != backend.Models.Enums.UserStatus.Invited;
        string? emailError = null;

        if (request.Status == backend.Models.Enums.UserStatus.Invited)
        {
            try
            {
                var loginUrl = "http://localhost:5173/auth/login";
                var emailBody = $@"
                    <h3>Welcome to GHL India Ventures, {request.Name}!</h3>
                    <p>You have been invited to join the platform as a <b>{role.Name}</b>.</p>
                    <p>Your temporary password is: <strong>{passwordToHash}</strong></p>
                    <p>Please login at <a href='{loginUrl}'>{loginUrl}</a> and change your password.</p>";
                    
                await _emailService.SendEmailAsync(request.Email, "Invitation to GHL India Ventures", emailBody);
                emailSent = true;
            }
            catch (Exception ex)
            {
                emailError = ex.Message.Contains("Daily user sending limit exceeded")
                    ? "Gmail daily sending limit exceeded for the sender email account."
                    : ex.Message;
                Console.WriteLine($"[AdminUserService] Warning: Email dispatch failed for {request.Email}: {ex.Message}");
            }
        }

        var dto = new AdminUserDto
        {
            Id = newUser.Id,
            Name = newUser.Name,
            Email = newUser.Email,
            Phone = newUser.Phone,
            RoleId = newUser.RoleId,
            RoleName = role.Name,
            RoleCode = role.Code,
            Status = newUser.Status,
            CreatedAt = newUser.CreatedAt,
            EmailSent = emailSent,
            EmailError = emailError,
            TemporaryPassword = passwordToHash
        };

        var message = emailSent
            ? "User created successfully and invitation email sent."
            : $"User created successfully. (Notice: Email delivery failed: {emailError})";

        return ApiResponse<AdminUserDto>.SuccessResult(dto, message);
    }

    public async Task<ApiResponse<AdminUserDto>> UpdateUserAsync(int companyId, int userId, UpdateUserRequestDto request, CancellationToken cancellationToken = default)
    {
        var user = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.CompanyId == companyId && u.Id == userId, cancellationToken);

        if (user == null)
            return ApiResponse<AdminUserDto>.FailureResult("User not found.");

        if (user.RoleId != request.RoleId)
        {
            var role = await _context.Roles.FindAsync(new object[] { request.RoleId }, cancellationToken);
            if (role == null) return ApiResponse<AdminUserDto>.FailureResult("Invalid Role ID.");
            user.Role = role;
        }

        user.Name = request.Name;
        user.Phone = request.Phone;
        user.RoleId = request.RoleId;
        user.Status = request.Status;
        if (!string.IsNullOrWhiteSpace(request.Password))
        {
            user.PasswordHash = backend.Helpers.PasswordHasher.HashPassword(request.Password);
            user.MustChangePassword = false;

            var activeSessions = await _context.UserSessions
                .Where(s => s.UserId == user.Id && s.IsActive)
                .ToListAsync(cancellationToken);

            foreach (var session in activeSessions)
            {
                session.IsActive = false;
                session.RevokedAt = DateTime.UtcNow;
                session.RevokedReason = "Administrator updated account password.";
            }
        }
        user.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        var dto = new AdminUserDto
        {
            Id = user.Id,
            Name = user.Name,
            Email = user.Email,
            Phone = user.Phone,
            RoleId = user.RoleId,
            RoleName = user.Role.Name,
            RoleCode = user.Role.Code,
            Status = user.Status,
            LastLoginAt = user.LastLoginAt,
            AvatarUrl = user.AvatarUrl,
            CreatedAt = user.CreatedAt
        };

        return ApiResponse<AdminUserDto>.SuccessResult(dto, "User updated successfully.");
    }

    public async Task<ApiResponse<AdminUserDto>> TransferDataAndUpdateRoleAsync(int companyId, int oldUserId, TransferRoleRequestDto request, CancellationToken cancellationToken = default)
    {
        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var oldUser = await _context.Users
                .Include(u => u.Role)
                .FirstOrDefaultAsync(u => u.CompanyId == companyId && u.Id == oldUserId, cancellationToken);

            if (oldUser == null)
                return ApiResponse<AdminUserDto>.FailureResult("Old user not found.");

            var newUser = await _context.Users
                .Include(u => u.Role)
                .FirstOrDefaultAsync(u => u.CompanyId == companyId && u.Id == request.NewUserId, cancellationToken);

            if (newUser == null)
                return ApiResponse<AdminUserDto>.FailureResult("New user not found.");

            var newRole = await _context.Roles.FindAsync(new object[] { request.NewRoleId }, cancellationToken);
            if (newRole == null)
                return ApiResponse<AdminUserDto>.FailureResult("Invalid New Role ID.");

            // Transfer Leads
            var leads = await _context.Leads
                .Where(l => l.CompanyId == companyId && l.AssignedAgentId == oldUserId)
                .ToListAsync(cancellationToken);

            foreach (var lead in leads)
            {
                lead.AssignedAgentId = request.NewUserId;
                
                // Add Assignment History
                _context.LeadAssignmentHistories.Add(new backend.Models.Entities.LeadAssignmentHistory
                {
                    LeadId = lead.Id,
                    FromAgentId = oldUserId,
                    ToAgentId = request.NewUserId,
                    AssignedById = oldUserId, // System fallback
                    Method = "manual",
                    AssignedAt = DateTime.UtcNow
                });
            }

            // Transfer Followups
            var followups = await _context.Followups
                .Where(f => f.CompanyId == companyId && f.AssignedAgentId == oldUserId)
                .ToListAsync(cancellationToken);

            foreach (var f in followups)
            {
                f.AssignedAgentId = request.NewUserId;
                f.AssignedToName = newUser.Name;
                f.AssignedToRole = newUser.Role?.Code ?? "sales_executive";
                f.UpdatedAt = DateTime.UtcNow;
            }

            // Update Old User Role
            oldUser.Role = newRole;
            oldUser.RoleId = request.NewRoleId;
            oldUser.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            var dto = new AdminUserDto
            {
                Id = oldUser.Id,
                Name = oldUser.Name,
                Email = oldUser.Email,
                Phone = oldUser.Phone,
                Status = oldUser.Status,
                CreatedAt = oldUser.CreatedAt,
                LastLoginAt = oldUser.LastLoginAt,
                AvatarUrl = oldUser.AvatarUrl,
                RoleId = oldUser.RoleId,
                RoleName = oldUser.Role.Name,
                RoleCode = oldUser.Role.Code
            };

            return ApiResponse<AdminUserDto>.SuccessResult(dto, "Transferred active data and updated role successfully.");
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiResponse<AdminUserDto>.FailureResult($"Transfer failed: {ex.Message}");
        }
    }

    public async Task<ApiResponse<UserWorkloadDto>> GetUserWorkloadAsync(int companyId, int userId, CancellationToken cancellationToken = default)
    {
        var user = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.CompanyId == companyId && u.Id == userId, cancellationToken);

        if (user == null)
            return ApiResponse<UserWorkloadDto>.FailureResult("User not found.");

        var roleCode = user.Role?.Code?.ToLowerInvariant() ?? string.Empty;
        var isIrm = roleCode == "irm";

        // 1. General Active Leads: assigned to this user and not terminal (Lost, Junk, Not Interested, Converted)
        var leads = await _context.Leads
            .Where(l => l.CompanyId == companyId && l.AssignedAgentId == userId)
            .ToListAsync(cancellationToken);
        var activeLeadsCount = leads.Count(l =>
            !string.Equals(l.Status, "Lost", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(l.Status, "Junk", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(l.Status, "Not Interested", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(l.Status, "Converted", StringComparison.OrdinalIgnoreCase));

        // 2. Pending Follow-ups: assigned to this user and Pending
        var followups = await _context.Followups
            .Where(f => f.CompanyId == companyId && f.AssignedAgentId == userId)
            .ToListAsync(cancellationToken);
        var pendingFollowupsCount = followups.Count(f =>
            f.Status == backend.Models.Enums.FollowupStatus.Pending);

        // 3. Active Deals: assigned to this user in GhlDeals and not terminal (converted, lost, Closed Won, Closed Lost)
        var deals = await _context.GhlDeals
            .Where(d => d.CompanyId == companyId && d.AssignedAgentId == userId)
            .ToListAsync(cancellationToken);
        var activeDealsCount = deals.Count(d =>
            !string.Equals(d.Stage, "converted", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(d.Stage, "lost", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(d.Stage, "Closed Won", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(d.Stage, "Closed Lost", StringComparison.OrdinalIgnoreCase));

        // 4. Assigned Customers: assigned to this user and active
        var customers = await _context.Customers
            .Where(c => c.CompanyId == companyId && c.AssignedAgentId == userId)
            .ToListAsync(cancellationToken);
        var assignedCustomersCount = customers.Count(c =>
            !string.Equals(c.Status, "Inactive", StringComparison.OrdinalIgnoreCase));

        // 5. Scheduled Consultations: assigned or referred to this user with Status == Scheduled
        var scheduledConsultationsCount = await _context.Consultations
            .Where(c => c.CompanyId == companyId &&
                        (c.ConsultantId == userId || (user.Name != null && c.ReferredByAgentName != null && EF.Functions.ILike(c.ReferredByAgentName, user.Name))) &&
                        c.Status == backend.Models.Enums.ConsultationStatus.Scheduled)
            .CountAsync(cancellationToken);

        // 6. IRM Specific Stage Classification (matches IRM All Leads / My Leads / Follow-up / KYC / Opportunities ledger)
        int myLeadsCount = 0;
        int inFollowupCount = 0;
        int kycCount = 0;
        int opportunitiesCount = 0;
        int convertedCount = 0;

        if (isIrm)
        {
            var pendingFollowupList = await _context.Followups
                .AsNoTracking()
                .Where(f => f.CompanyId == companyId && f.Status == backend.Models.Enums.FollowupStatus.Pending)
                .Select(f => new { f.ContactId, f.ContactPhone })
                .ToListAsync(cancellationToken);

            var kycRecords = await _context.InvestorKycs
                .AsNoTracking()
                .Where(k => k.CompanyId == companyId)
                .Select(k => new { k.Phone, k.Email, k.InvestorName, Status = k.Status.ToString() })
                .ToListAsync(cancellationToken);

            var investorsList = await _context.Investors
                .AsNoTracking()
                .Where(i => i.CompanyId == companyId)
                .Select(i => new { i.Id, i.Phone, i.Email, i.Name, Status = i.Status.ToString() })
                .ToListAsync(cancellationToken);

            var customersList = await _context.Customers
                .AsNoTracking()
                .Where(c => c.CompanyId == companyId)
                .Select(c => new { c.Id, c.Phone, c.Email, c.Name })
                .ToListAsync(cancellationToken);

            var dealsList = await _context.GhlDeals
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
                .ToListAsync(cancellationToken);

            foreach (var l in leads)
            {
                var phoneDigits = new string((l.Phone ?? string.Empty).Where(char.IsDigit).ToArray());
                var phoneLast10 = phoneDigits.Length >= 10 ? phoneDigits[^10..] : phoneDigits;
                var leadEmailLower = (l.Email ?? string.Empty).Trim().ToLower();
                var leadNameLower = (l.Name ?? string.Empty).Trim().ToLower();

                var matchedCustomer = customersList.FirstOrDefault(c =>
                    (!string.IsNullOrWhiteSpace(phoneLast10) && (new string((c.Phone ?? string.Empty).Where(char.IsDigit).ToArray()).EndsWith(phoneLast10))) ||
                    (!string.IsNullOrWhiteSpace(leadEmailLower) && !string.IsNullOrWhiteSpace(c.Email) && c.Email.Trim().ToLower() == leadEmailLower) ||
                    (!string.IsNullOrWhiteSpace(leadNameLower) && c.Name.Trim().ToLower() == leadNameLower));

                var matchedInvestor = investorsList.FirstOrDefault(i =>
                    (!string.IsNullOrWhiteSpace(phoneLast10) && (new string((i.Phone ?? string.Empty).Where(char.IsDigit).ToArray()).EndsWith(phoneLast10))) ||
                    (!string.IsNullOrWhiteSpace(leadEmailLower) && !string.IsNullOrWhiteSpace(i.Email) && i.Email.Trim().ToLower() == leadEmailLower) ||
                    (!string.IsNullOrWhiteSpace(leadNameLower) && i.Name.Trim().ToLower() == leadNameLower));

                var matchedDeal = dealsList.FirstOrDefault(d =>
                    (matchedCustomer != null && d.CustomerId == matchedCustomer.Id) ||
                    (!string.IsNullOrWhiteSpace(phoneLast10) && (new string((d.CustomerPhone ?? string.Empty).Where(char.IsDigit).ToArray()).EndsWith(phoneLast10))) ||
                    (!string.IsNullOrWhiteSpace(leadEmailLower) && !string.IsNullOrWhiteSpace(d.CustomerEmail) && d.CustomerEmail.Trim().ToLower() == leadEmailLower) ||
                    (!string.IsNullOrWhiteSpace(leadNameLower) && d.CustomerName.Trim().ToLower() == leadNameLower));

                var matchedKyc = kycRecords.FirstOrDefault(k =>
                    (!string.IsNullOrWhiteSpace(phoneLast10) && (new string((k.Phone ?? string.Empty).Where(char.IsDigit).ToArray()).EndsWith(phoneLast10))) ||
                    (!string.IsNullOrWhiteSpace(leadEmailLower) && !string.IsNullOrWhiteSpace(k.Email) && k.Email.Trim().ToLower() == leadEmailLower) ||
                    (!string.IsNullOrWhiteSpace(leadNameLower) && k.InvestorName.Trim().ToLower() == leadNameLower));

                var matchedFollowup = pendingFollowupList.FirstOrDefault(f =>
                    (f.ContactId != null && f.ContactId == l.Id.ToString()) ||
                    (!string.IsNullOrWhiteSpace(phoneLast10) && (new string((f.ContactPhone ?? string.Empty).Where(char.IsDigit).ToArray()).EndsWith(phoneLast10))));

                string currentStage = "My Leads";
                if (matchedDeal != null)
                {
                    var dStage = (matchedDeal.Stage ?? string.Empty).Trim().ToLowerInvariant();
                    if (dStage == "qualified_investor" || dStage == "qualified")
                        currentStage = "KYC";
                    else if (dStage == "investment_opportunity" || dStage == "opportunity" || dStage == "term_sheet" || dStage == "committed")
                        currentStage = "Opportunities";
                    else if (dStage == "converted" || dStage == "won")
                        currentStage = "Converted";
                    else if (dStage == "followup")
                        currentStage = "Follow-up";
                    else
                        currentStage = "My Leads";
                }
                else if (matchedInvestor != null || (matchedKyc != null && matchedKyc.Status.Equals("Approved", StringComparison.OrdinalIgnoreCase)))
                {
                    currentStage = "Investor 360";
                }
                else if (matchedKyc != null || (!string.IsNullOrWhiteSpace(l.CustomFieldsJson) && l.CustomFieldsJson.Contains("kyc", StringComparison.OrdinalIgnoreCase)))
                {
                    currentStage = "KYC";
                }
                else if (matchedFollowup != null || l.Status.Equals("Follow-up Required", StringComparison.OrdinalIgnoreCase) || l.Status.Equals("Callback", StringComparison.OrdinalIgnoreCase))
                {
                    currentStage = "Follow-up";
                }
                else if (l.Status.Equals("Converted", StringComparison.OrdinalIgnoreCase))
                {
                    currentStage = "Converted";
                }
                else if (!l.Status.Equals("Lost", StringComparison.OrdinalIgnoreCase) && !l.Status.Equals("Junk", StringComparison.OrdinalIgnoreCase))
                {
                    currentStage = "My Leads";
                }

                if (currentStage == "My Leads") myLeadsCount++;
                else if (currentStage == "Follow-up") inFollowupCount++;
                else if (currentStage == "KYC") kycCount++;
                else if (currentStage == "Opportunities") opportunitiesCount++;
                else if (currentStage == "Converted") convertedCount++;
            }
        }

        var total = isIrm 
            ? (myLeadsCount + inFollowupCount + kycCount + opportunitiesCount)
            : (roleCode == "sales_executive"
                ? (activeLeadsCount + pendingFollowupsCount + scheduledConsultationsCount)
                : (activeLeadsCount + pendingFollowupsCount + activeDealsCount + assignedCustomersCount));

        var dto = new UserWorkloadDto
        {
            UserId = user.Id,
            UserName = user.Name,
            RoleCode = roleCode,
            LeadsCount = activeLeadsCount,
            FollowupsCount = pendingFollowupsCount,
            DealsCount = activeDealsCount,
            CustomersCount = assignedCustomersCount,
            ConsultationsCount = scheduledConsultationsCount,
            MyLeadsCount = myLeadsCount,
            InFollowupCount = inFollowupCount,
            KycCount = kycCount,
            OpportunitiesCount = opportunitiesCount,
            ConvertedCount = convertedCount,
            Total = total
        };

        return ApiResponse<UserWorkloadDto>.SuccessResult(dto);
    }

    public async Task<ApiResponse<bool>> DeleteUserAsync(int companyId, int userId, int? handoverToUserId = null, CancellationToken cancellationToken = default)
    {
        var user = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.CompanyId == companyId && u.Id == userId, cancellationToken);

        if (user == null)
            return ApiResponse<bool>.FailureResult("User not found.");

        if (user.RoleId == 2) // Company Admin
            return ApiResponse<bool>.FailureResult("Primary Company Admin account cannot be deleted.");

        // Check active workloads
        var leads = await _context.Leads
            .Where(l => l.CompanyId == companyId && l.AssignedAgentId == userId)
            .ToListAsync(cancellationToken);

        var followups = await _context.Followups
            .Where(f => f.CompanyId == companyId && f.AssignedAgentId == userId)
            .ToListAsync(cancellationToken);

        var customers = await _context.Customers
            .Where(c => c.CompanyId == companyId && c.AssignedAgentId == userId)
            .ToListAsync(cancellationToken);

        var deals = await _context.GhlDeals
            .Where(d => d.CompanyId == companyId && d.AssignedAgentId == userId)
            .ToListAsync(cancellationToken);

        var investors = await _context.Investors
            .Where(i => i.CompanyId == companyId && i.AssignedIrmId == userId)
            .ToListAsync(cancellationToken);

        var irmCards = await _context.IrmPipelineCards
            .Where(c => c.CompanyId == companyId && c.AssignedIrmId == userId)
            .ToListAsync(cancellationToken);

        var consultations = await _context.Consultations
            .Where(c => c.CompanyId == companyId &&
                        (c.ConsultantId == userId || (user.Name != null && c.ReferredByAgentName != null && EF.Functions.ILike(c.ReferredByAgentName, user.Name))))
            .ToListAsync(cancellationToken);

        var totalActive = leads.Count + followups.Count + customers.Count + deals.Count + investors.Count + irmCards.Count + consultations.Count;

        backend.Models.Entities.User? handoverUser = null;
        if (handoverToUserId.HasValue && handoverToUserId.Value > 0)
        {
            if (handoverToUserId.Value == userId)
                return ApiResponse<bool>.FailureResult("Handover recipient cannot be the user being deleted.");

            handoverUser = await _context.Users
                .Include(u => u.Role)
                .FirstOrDefaultAsync(u => u.CompanyId == companyId && u.Id == handoverToUserId.Value && u.Status == backend.Models.Enums.UserStatus.Active, cancellationToken);

            if (handoverUser == null)
                return ApiResponse<bool>.FailureResult("Selected handover recipient user not found or is inactive.");

            // Strict role matching check: IRM -> IRM, Sales Executive -> Sales Executive
            if (handoverUser.RoleId != user.RoleId)
                return ApiResponse<bool>.FailureResult($"Successor agent must have the same role ({user.Role?.Name ?? "Same Role"}). Cannot hand over work across different roles.");
        }
        else if (totalActive > 0)
        {
            return ApiResponse<bool>.FailureResult($"Cannot delete '{user.Name}' without reassigning active work. This user currently has {leads.Count} assigned leads, {followups.Count} follow-ups, {deals.Count} deals, and {customers.Count} customers. Please select an active team member to hand over these items.");
        }

        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            // 1. Reassign customers to handoverUser or fallback admin
            var customerTargetUser = handoverUser ?? await _context.Users
                .Where(u => u.CompanyId == companyId && u.Id != userId && u.Status == backend.Models.Enums.UserStatus.Active)
                .OrderBy(u => u.RoleId == 2 ? 0 : 1) // Prefer Company Admin
                .FirstOrDefaultAsync(cancellationToken);

            if (customerTargetUser != null)
            {
                foreach (var c in customers)
                {
                    c.AssignedAgentId = customerTargetUser.Id;
                }
            }

            // 2. Reassign Leads or unlink if none
            if (handoverUser != null)
            {
                foreach (var l in leads)
                {
                    l.AssignedAgentId = handoverUser.Id;

                    _context.LeadAssignmentHistories.Add(new backend.Models.Entities.LeadAssignmentHistory
                    {
                        LeadId = l.Id,
                        FromAgentId = userId,
                        ToAgentId = handoverUser.Id,
                        AssignedById = userId,
                        Method = "user_deletion_handover",
                        AssignedAt = DateTime.UtcNow
                    });
                }
            }
            else
            {
                foreach (var l in leads)
                {
                    l.AssignedAgentId = null;
                }
            }

            // 3. Reassign Followups if handoverUser exists, preserving them; otherwise remove
            if (handoverUser != null)
            {
                foreach (var f in followups)
                {
                    f.AssignedAgentId = handoverUser.Id;
                    f.AssignedToName = handoverUser.Name;
                    f.AssignedToRole = handoverUser.Role?.Code ?? "sales_executive";
                    f.UpdatedAt = DateTime.UtcNow;
                }
            }
            else
            {
                _context.Followups.RemoveRange(followups);
            }

            // 4. Reassign GhlDeals
            if (handoverUser != null)
            {
                foreach (var d in deals)
                {
                    d.AssignedAgentId = handoverUser.Id;
                }
            }

            // 5. Reassign Investors & IrmPipelineCards
            if (handoverUser != null)
            {
                foreach (var inv in investors)
                {
                    inv.AssignedIrmId = handoverUser.Id;
                    inv.AssignedIrmName = handoverUser.Name;
                }

                foreach (var card in irmCards)
                {
                    card.AssignedIrmId = handoverUser.Id;
                    card.AssignedIrmName = handoverUser.Name;
                }

                // 6. Reassign Consultations
                foreach (var c in consultations)
                {
                    if (c.ConsultantId == userId)
                    {
                        c.ConsultantId = handoverUser.Id;
                        c.ConsultantName = handoverUser.Name;
                    }
                    if (!string.IsNullOrWhiteSpace(c.ReferredByAgentName) && user.Name != null && c.ReferredByAgentName.Equals(user.Name, StringComparison.OrdinalIgnoreCase))
                    {
                        c.ReferredByAgentName = handoverUser.Name;
                    }
                }
            }

            // 7. Remove user
            _context.Users.Remove(user);

            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            var message = handoverUser != null
                ? $"User '{user.Name}' deleted. All active items were successfully handed over to {handoverUser.Name}."
                : $"User '{user.Name}' deleted successfully.";

            return ApiResponse<bool>.SuccessResult(true, message);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiResponse<bool>.FailureResult($"Failed to delete user: {ex.Message}");
        }
    }

    public async Task<ApiResponse<ResetPasswordResponseDto>> ResetUserPasswordAsync(
        int companyId,
        int userId,
        string? customPassword = null,
        CancellationToken cancellationToken = default)
    {
        var user = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => (companyId == 0 || u.CompanyId == companyId) && u.Id == userId, cancellationToken);

        if (user == null)
            return ApiResponse<ResetPasswordResponseDto>.FailureResult("User not found.");

        if (user.RoleId == 1) // super_admin
            return ApiResponse<ResetPasswordResponseDto>.FailureResult("Cannot reset credentials for a platform super administrator.");

        if (!string.IsNullOrWhiteSpace(customPassword) && customPassword.Trim().Length < 6)
        {
            return ApiResponse<ResetPasswordResponseDto>.FailureResult("Password must be at least 6 characters long.");
        }

        var newPassword = !string.IsNullOrWhiteSpace(customPassword)
            ? customPassword.Trim()
            : backend.Helpers.PasswordHasher.GenerateTemporaryPassword();

        user.PasswordHash = backend.Helpers.PasswordHasher.HashPassword(newPassword);
        user.MustChangePassword = false;
        user.UpdatedAt = DateTime.UtcNow;

        // Invalidate all active user sessions for this user so old sessions cannot linger
        var sessions = await _context.UserSessions
            .Where(s => s.UserId == user.Id && s.IsActive)
            .ToListAsync(cancellationToken);

        foreach (var s in sessions)
        {
            s.IsActive = false;
            s.RevokedAt = DateTime.UtcNow;
            s.RevokedReason = "Administrator reset account credentials.";
        }

        // Record security event
        _context.SecurityEvents.Add(new SecurityEvent
        {
            EventType = "PASSWORD_RESET_ADMIN",
            Severity = "WARNING",
            Description = $"Administrator reset password for user '{user.Email}' (ID: {user.Id}).",
            UserEmail = user.Email,
            UserId = user.Id,
            Timestamp = DateTime.UtcNow
        });

        // Audit log entry
        _context.AuditLogs.Add(new AuditLog
        {
            Action = "USER_PASSWORD_RESET",
            EntityType = "User",
            EntityId = user.Id.ToString(),
            CompanyId = user.CompanyId,
            ActorName = "Administrator",
            ActorEmail = "admin@nexus.com",
            Details = $"Administrator reset password for user '{user.Name}' ({user.Email}). Active sessions revoked.",
            Module = "Users",
            Status = "success",
            Timestamp = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(cancellationToken);

        if (_hubContext != null)
        {
            try
            {
                await _hubContext.Clients.Group($"user_{user.Id}").SessionRevoked("ALL", user.Id);
            }
            catch { }
        }

        var responseDto = new ResetPasswordResponseDto
        {
            UserId = user.Id,
            Email = user.Email,
            TempPassword = newPassword
        };

        return ApiResponse<ResetPasswordResponseDto>.SuccessResult(responseDto, "Password reset successfully.");
    }
}
