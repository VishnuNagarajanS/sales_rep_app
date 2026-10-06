using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using backend.Data;
using backend.DTOs.Admin;
using backend.DTOs.Common;
using backend.Models.Entities;
using backend.Models.Enums;
using backend.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Implementations;

public class LeaveRequestService : ILeaveRequestService
{
    private readonly ApplicationDbContext _db;

    public LeaveRequestService(ApplicationDbContext db)
    {
        _db = db;
    }

    public static decimal CalculateWorkingDays(DateOnly start, DateOnly end, bool isHalfDay)
    {
        if (isHalfDay) return 0.5m;
        if (end < start) return 0m;

        decimal days = 0;
        var cur = start;
        while (cur <= end)
        {
            if (cur.DayOfWeek != DayOfWeek.Saturday && cur.DayOfWeek != DayOfWeek.Sunday)
            {
                days += 1.0m;
            }
            cur = cur.AddDays(1);
        }
        return days;
    }

    private DateOnly GetCompanyToday(Tenant? tenant)
    {
        var nowUtc = DateTime.UtcNow;
        try
        {
            var tzId = string.IsNullOrWhiteSpace(tenant?.Timezone) ? "India Standard Time" : tenant.Timezone;
            TimeZoneInfo tz;
            if (tzId.Equals("Asia/Kolkata", StringComparison.OrdinalIgnoreCase) || tzId.Equals("India Standard Time", StringComparison.OrdinalIgnoreCase))
            {
                tz = TimeZoneInfo.FindSystemTimeZoneById(OperatingSystem.IsWindows() ? "India Standard Time" : "Asia/Kolkata");
            }
            else
            {
                tz = TimeZoneInfo.FindSystemTimeZoneById(tzId);
            }
            return DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(nowUtc, tz));
        }
        catch
        {
            return DateOnly.FromDateTime(nowUtc.AddHours(5).AddMinutes(30));
        }
    }

    public async Task<ApiResponse<List<LeaveRequestDto>>> GetLeaveRequestsAsync(
        int companyId,
        int? userId,
        string? status,
        string? type,
        string? handoverState,
        string? search,
        DateOnly? from,
        DateOnly? to,
        CancellationToken cancellationToken = default)
    {
        var query = _db.LeaveRequests
            .Include(lr => lr.User)
                .ThenInclude(u => u!.Role)
            .Include(lr => lr.ApprovedBy)
            .Include(lr => lr.DecidedBy)
            .Include(lr => lr.CancelledBy)
            .Where(lr => lr.CompanyId == companyId);

        if (userId.HasValue)
            query = query.Where(lr => lr.UserId == userId.Value);

        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("All", StringComparison.OrdinalIgnoreCase))
            query = query.Where(lr => lr.Status.ToLower() == status.ToLower());

        if (!string.IsNullOrWhiteSpace(type) && !type.Equals("All", StringComparison.OrdinalIgnoreCase))
            query = query.Where(lr => lr.LeaveType.ToLower() == type.ToLower());

        if (from.HasValue)
            query = query.Where(lr => lr.EndDate >= from.Value);

        if (to.HasValue)
            query = query.Where(lr => lr.StartDate <= to.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(lr => (lr.User != null && lr.User.Name.ToLower().Contains(term)) ||
                                      lr.Reason.ToLower().Contains(term));
        }

        var list = await query.OrderByDescending(lr => lr.CreatedAt).ToListAsync(cancellationToken);

        // Fetch active and ended handovers for derived state calculation
        var userIds = list.Select(l => l.UserId).Distinct().ToList();
        var handovers = await _db.WorkHandovers
            .Include(wh => wh.CoveringUser)
            .Where(wh => wh.CompanyId == companyId && userIds.Contains(wh.OriginalUserId))
            .ToListAsync(cancellationToken);

        var dtos = list.Select(lr => MapToDto(lr, handovers)).ToList();

        if (!string.IsNullOrWhiteSpace(handoverState) && !handoverState.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            dtos = dtos.Where(d => d.HandoverState.Equals(handoverState, StringComparison.OrdinalIgnoreCase)).ToList();
        }

        return ApiResponse<List<LeaveRequestDto>>.SuccessResult(dtos);
    }

    public async Task<ApiResponse<LeaveRequestDetailDto>> GetLeaveRequestDetailAsync(int companyId, int id, CancellationToken cancellationToken = default)
    {
        var req = await _db.LeaveRequests
            .Include(lr => lr.User)
                .ThenInclude(u => u!.Role)
            .Include(lr => lr.ApprovedBy)
            .Include(lr => lr.DecidedBy)
            .Include(lr => lr.CancelledBy)
            .Include(lr => lr.Events)
                .ThenInclude(e => e.Actor)
            .FirstOrDefaultAsync(lr => lr.Id == id && lr.CompanyId == companyId, cancellationToken);

        if (req == null)
            return ApiResponse<LeaveRequestDetailDto>.FailureResult("Leave request not found.");

        var handovers = await _db.WorkHandovers
            .Include(wh => wh.CoveringUser)
            .Where(wh => wh.CompanyId == companyId && wh.OriginalUserId == req.UserId)
            .ToListAsync(cancellationToken);

        var baseDto = MapToDto(req, handovers);

        var balanceResult = await GetUserLeaveBalancesAsync(companyId, req.UserId, cancellationToken);

        var detail = new LeaveRequestDetailDto
        {
            Id = baseDto.Id,
            CompanyId = baseDto.CompanyId,
            UserId = baseDto.UserId,
            UserName = baseDto.UserName,
            UserRole = baseDto.UserRole,
            LeaveType = baseDto.LeaveType,
            StartDate = baseDto.StartDate,
            EndDate = baseDto.EndDate,
            IsHalfDay = baseDto.IsHalfDay,
            HalfDaySession = baseDto.HalfDaySession,
            Days = baseDto.Days,
            Reason = baseDto.Reason,
            Status = baseDto.Status,
            WorkHandoverId = baseDto.WorkHandoverId,
            ApprovedById = baseDto.ApprovedById,
            ApprovedByName = baseDto.ApprovedByName,
            DecidedById = baseDto.DecidedById,
            DecidedByName = baseDto.DecidedByName,
            DecisionAt = baseDto.DecisionAt,
            DecisionNote = baseDto.DecisionNote,
            CancelledById = baseDto.CancelledById,
            CancelledByName = baseDto.CancelledByName,
            CancelledAt = baseDto.CancelledAt,
            HandoverDecision = baseDto.HandoverDecision,
            HandoverDecisionNote = baseDto.HandoverDecisionNote,
            HandoverState = baseDto.HandoverState,
            CoveringUserId = baseDto.CoveringUserId,
            CoveringUserName = baseDto.CoveringUserName,
            CreatedAt = baseDto.CreatedAt,
            Events = req.Events.OrderBy(e => e.At).Select(e => new LeaveRequestEventDto
            {
                Id = e.Id,
                Action = e.Action,
                ActorId = e.ActorId,
                ActorName = e.Actor?.Name ?? "User",
                Note = e.Note,
                At = e.At
            }).ToList(),
            RequesterBalances = balanceResult.Data ?? new List<LeaveBalanceDto>()
        };

        return ApiResponse<LeaveRequestDetailDto>.SuccessResult(detail);
    }

    public async Task<ApiResponse<List<LeaveBalanceDto>>> GetUserLeaveBalancesAsync(int companyId, int userId, CancellationToken cancellationToken = default)
    {
        var policies = await _db.LeavePolicies
            .Where(lp => lp.CompanyId == companyId)
            .ToListAsync(cancellationToken);

        var currentYear = DateTime.UtcNow.Year;

        var userApprovedLeaves = await _db.LeaveRequests
            .Where(lr => lr.CompanyId == companyId && lr.UserId == userId && lr.Status == "Approved" && lr.StartDate.Year == currentYear)
            .ToListAsync(cancellationToken);

        var userPendingLeaves = await _db.LeaveRequests
            .Where(lr => lr.CompanyId == companyId && lr.UserId == userId && lr.Status == "Pending" && lr.StartDate.Year == currentYear)
            .ToListAsync(cancellationToken);

        var defaultQuotas = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase)
        {
            { "Casual", 12m },
            { "Sick", 8m },
            { "Earned", 15m },
            { "Unpaid", 999m },
            { "Other", 0m }
        };

        var types = new[] { "Casual", "Sick", "Earned", "Unpaid", "Other" };
        var balances = new List<LeaveBalanceDto>();

        foreach (var type in types)
        {
            var policy = policies.FirstOrDefault(p => p.LeaveType.Equals(type, StringComparison.OrdinalIgnoreCase));
            var quota = policy?.AnnualQuotaDays ?? (defaultQuotas.TryGetValue(type, out var q) ? q : 0m);

            var used = userApprovedLeaves
                .Where(lr => lr.LeaveType.Equals(type, StringComparison.OrdinalIgnoreCase))
                .Sum(lr => lr.Days);

            var pending = userPendingLeaves
                .Where(lr => lr.LeaveType.Equals(type, StringComparison.OrdinalIgnoreCase))
                .Sum(lr => lr.Days);

            var remaining = quota >= 999m ? 999m : Math.Max(0m, quota - used);

            balances.Add(new LeaveBalanceDto
            {
                LeaveType = type,
                Quota = quota,
                Used = used,
                Pending = pending,
                Remaining = remaining
            });
        }

        return ApiResponse<List<LeaveBalanceDto>>.SuccessResult(balances);
    }

    public async Task<ApiResponse<LeaveConflictsDto>> GetLeaveConflictsAsync(int companyId, int leaveRequestId, CancellationToken cancellationToken = default)
    {
        var req = await _db.LeaveRequests
            .Include(lr => lr.User)
                .ThenInclude(u => u!.Role)
            .FirstOrDefaultAsync(lr => lr.Id == leaveRequestId && lr.CompanyId == companyId, cancellationToken);

        if (req == null)
            return ApiResponse<LeaveConflictsDto>.FailureResult("Leave request not found.");

        var roleCode = req.User?.Role?.Code;
        if (string.IsNullOrWhiteSpace(roleCode))
        {
            return ApiResponse<LeaveConflictsDto>.SuccessResult(new LeaveConflictsDto());
        }

        var totalRoleUsers = await _db.Users
            .Include(u => u.Role)
            .CountAsync(u => u.CompanyId == companyId && u.Role != null && u.Role.Code == roleCode && u.Status == UserStatus.Active, cancellationToken);

        var overlappingLeaves = await _db.LeaveRequests
            .Include(lr => lr.User)
                .ThenInclude(u => u!.Role)
            .Where(lr => lr.CompanyId == companyId
                      && lr.Id != req.Id
                      && lr.User != null
                      && lr.User.Role != null
                      && lr.User.Role.Code == roleCode
                      && (lr.Status == "Pending" || lr.Status == "Approved")
                      && lr.StartDate <= req.EndDate
                      && req.StartDate <= lr.EndDate)
            .ToListAsync(cancellationToken);

        var conflictList = overlappingLeaves.Select(ol => new TeammateConflictDto
        {
            UserId = ol.UserId,
            UserName = ol.User?.Name ?? "Teammate",
            RoleCode = ol.User?.Role?.Code ?? roleCode,
            StartDate = ol.StartDate,
            EndDate = ol.EndDate,
            Days = ol.Days,
            Status = ol.Status,
            LeaveType = ol.LeaveType
        }).ToList();

        var conflictingUsersCount = overlappingLeaves.Select(ol => ol.UserId).Distinct().Count();
        decimal totalAway = conflictingUsersCount + 1; // plus this applicant
        decimal percentageAway = totalRoleUsers > 0 ? Math.Round((totalAway / (decimal)totalRoleUsers) * 100m, 1) : 0m;

        return ApiResponse<LeaveConflictsDto>.SuccessResult(new LeaveConflictsDto
        {
            HasConflict = conflictList.Count > 0,
            PercentageAway = percentageAway,
            IsHighAbsenceRate = percentageAway > 30m,
            Conflicts = conflictList
        });
    }

    public async Task<ApiResponse<LeaveRequestDto>> CreateLeaveRequestAsync(int companyId, int userId, CreateLeaveRequestDto dto, CancellationToken cancellationToken = default)
    {
        var tenant = await _db.Tenants.FindAsync(new object[] { companyId }, cancellationToken);
        var today = GetCompanyToday(tenant);

        if (dto.StartDate < today)
            return ApiResponse<LeaveRequestDto>.FailureResult("Start date cannot be in the past.");
        if (dto.EndDate < dto.StartDate)
            return ApiResponse<LeaveRequestDto>.FailureResult("End date must be on or after start date.");

        if (dto.IsHalfDay && dto.StartDate != dto.EndDate)
            return ApiResponse<LeaveRequestDto>.FailureResult("Half-day leave can only be requested for a single day.");

        var days = CalculateWorkingDays(dto.StartDate, dto.EndDate, dto.IsHalfDay);
        if (days <= 0)
            return ApiResponse<LeaveRequestDto>.FailureResult("Selected date range contains no working days (Monday-Friday).");

        if (dto.Reason != null && dto.Reason.Length > 500)
            return ApiResponse<LeaveRequestDto>.FailureResult("Reason cannot exceed 500 characters.");

        if (string.IsNullOrWhiteSpace(dto.Reason) && (days > 3 || dto.LeaveType.Equals("Other", StringComparison.OrdinalIgnoreCase)))
            return ApiResponse<LeaveRequestDto>.FailureResult("Reason is required for leave exceeding 3 days or for leave type 'Other'.");

        // Check overlap with user's own Pending or Approved leaves
        var hasOverlap = await _db.LeaveRequests.AnyAsync(lr =>
            lr.CompanyId == companyId &&
            lr.UserId == userId &&
            (lr.Status == "Pending" || lr.Status == "Approved") &&
            lr.StartDate <= dto.EndDate &&
            dto.StartDate <= lr.EndDate,
            cancellationToken);

        if (hasOverlap)
            return ApiResponse<LeaveRequestDto>.FailureResult("You already have a Pending or Approved leave request overlapping these dates.");

        var user = await _db.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        if (user == null)
            return ApiResponse<LeaveRequestDto>.FailureResult("User not found.");

        var req = new LeaveRequest
        {
            CompanyId = companyId,
            UserId = userId,
            LeaveType = string.IsNullOrWhiteSpace(dto.LeaveType) ? "Casual" : dto.LeaveType,
            StartDate = dto.StartDate,
            EndDate = dto.EndDate,
            IsHalfDay = dto.IsHalfDay,
            HalfDaySession = dto.IsHalfDay ? dto.HalfDaySession : null,
            Days = days,
            Reason = dto.Reason?.Trim() ?? string.Empty,
            Status = "Pending",
            HandoverDecision = "pending",
            CreatedAt = DateTime.UtcNow
        };

        _db.LeaveRequests.Add(req);
        await _db.SaveChangesAsync(cancellationToken);

        // Timeline event
        _db.LeaveRequestEvents.Add(new LeaveRequestEvent
        {
            LeaveRequestId = req.Id,
            Action = "submitted",
            ActorId = userId,
            Note = req.Reason,
            At = DateTime.UtcNow
        });

        // Audit log
        _db.AuditLogs.Add(new AuditLog
        {
            CompanyId = companyId,
            ActorName = user.Name,
            ActorEmail = user.Email,
            Action = "CREATE",
            EntityType = "LeaveRequest",
            EntityId = req.Id.ToString(),
            Details = $"Submitted {req.LeaveType} leave request for {req.Days} days ({req.StartDate} to {req.EndDate}).",
            Timestamp = DateTime.UtcNow
        });

        // Notify all company admins
        var admins = await _db.Users
            .Include(u => u.Role)
            .Where(u => u.CompanyId == companyId &&
                        u.Role != null &&
                        (u.Role.Code == "company_admin" || u.Role.Code == "super_admin") &&
                        u.Status == UserStatus.Active)
            .ToListAsync(cancellationToken);

        foreach (var admin in admins)
        {
            _db.Notifications.Add(new Notification
            {
                CompanyId = companyId,
                UserId = admin.Id,
                Title = "New Leave Request",
                Message = $"{user.Name} ({user.Role?.Name ?? "Employee"}) requested {req.Days} day(s) of {req.LeaveType} leave ({req.StartDate:d MMM} - {req.EndDate:d MMM}).",
                Type = "leave_submitted",
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            });
        }

        await _db.SaveChangesAsync(cancellationToken);

        return await GetSingleDto(companyId, req.Id, cancellationToken);
    }

    public async Task<ApiResponse<LeaveRequestDto>> UpdateLeaveRequestAsync(int companyId, int userId, int id, UpdateLeaveRequestDto dto, CancellationToken cancellationToken = default)
    {
        var req = await _db.LeaveRequests
            .Include(lr => lr.User)
            .FirstOrDefaultAsync(lr => lr.Id == id && lr.CompanyId == companyId && lr.UserId == userId, cancellationToken);

        if (req == null)
            return ApiResponse<LeaveRequestDto>.FailureResult("Leave request not found.");

        if (req.Status != "Pending")
            return ApiResponse<LeaveRequestDto>.FailureResult("Only pending leave requests can be edited.");

        var tenant = await _db.Tenants.FindAsync(new object[] { companyId }, cancellationToken);
        var today = GetCompanyToday(tenant);

        if (dto.StartDate < today)
            return ApiResponse<LeaveRequestDto>.FailureResult("Start date cannot be in the past.");
        if (dto.EndDate < dto.StartDate)
            return ApiResponse<LeaveRequestDto>.FailureResult("End date must be on or after start date.");

        if (dto.IsHalfDay && dto.StartDate != dto.EndDate)
            return ApiResponse<LeaveRequestDto>.FailureResult("Half-day leave can only be requested for a single day.");

        var days = CalculateWorkingDays(dto.StartDate, dto.EndDate, dto.IsHalfDay);
        if (days <= 0)
            return ApiResponse<LeaveRequestDto>.FailureResult("Selected date range contains no working days (Monday-Friday).");

        if (dto.Reason != null && dto.Reason.Length > 500)
            return ApiResponse<LeaveRequestDto>.FailureResult("Reason cannot exceed 500 characters.");

        if (string.IsNullOrWhiteSpace(dto.Reason) && (days > 3 || dto.LeaveType.Equals("Other", StringComparison.OrdinalIgnoreCase)))
            return ApiResponse<LeaveRequestDto>.FailureResult("Reason is required for leave exceeding 3 days or for leave type 'Other'.");

        var hasOverlap = await _db.LeaveRequests.AnyAsync(lr =>
            lr.CompanyId == companyId &&
            lr.UserId == userId &&
            lr.Id != id &&
            (lr.Status == "Pending" || lr.Status == "Approved") &&
            lr.StartDate <= dto.EndDate &&
            dto.StartDate <= lr.EndDate,
            cancellationToken);

        if (hasOverlap)
            return ApiResponse<LeaveRequestDto>.FailureResult("You already have another Pending or Approved leave request overlapping these dates.");

        req.LeaveType = string.IsNullOrWhiteSpace(dto.LeaveType) ? req.LeaveType : dto.LeaveType;
        req.StartDate = dto.StartDate;
        req.EndDate = dto.EndDate;
        req.IsHalfDay = dto.IsHalfDay;
        req.HalfDaySession = dto.IsHalfDay ? dto.HalfDaySession : null;
        req.Days = days;
        req.Reason = dto.Reason?.Trim() ?? string.Empty;
        req.UpdatedAt = DateTime.UtcNow;

        _db.LeaveRequestEvents.Add(new LeaveRequestEvent
        {
            LeaveRequestId = req.Id,
            Action = "edited",
            ActorId = userId,
            Note = $"Dates changed to {req.StartDate} - {req.EndDate} ({req.Days} days).",
            At = DateTime.UtcNow
        });

        await _db.SaveChangesAsync(cancellationToken);

        return await GetSingleDto(companyId, req.Id, cancellationToken);
    }

    public async Task<ApiResponse<LeaveRequestDto>> CancelLeaveRequestAsync(int companyId, int userId, int id, CancellationToken cancellationToken = default)
    {
        var req = await _db.LeaveRequests
            .Include(lr => lr.User)
            .FirstOrDefaultAsync(lr => lr.Id == id && lr.CompanyId == companyId && lr.UserId == userId, cancellationToken);

        if (req == null)
            return ApiResponse<LeaveRequestDto>.FailureResult("Leave request not found.");

        var tenant = await _db.Tenants.FindAsync(new object[] { companyId }, cancellationToken);
        var today = GetCompanyToday(tenant);

        if (req.Status == "Cancelled" || req.Status == "Rejected")
            return ApiResponse<LeaveRequestDto>.FailureResult($"Cannot cancel request with status {req.Status}.");

        if (req.Status == "Approved" && req.EndDate < today)
            return ApiResponse<LeaveRequestDto>.FailureResult("Cannot cancel an approved leave that has already ended.");

        var wasApproved = req.Status == "Approved";

        req.Status = "Cancelled";
        req.CancelledById = userId;
        req.CancelledAt = DateTime.UtcNow;
        req.UpdatedAt = DateTime.UtcNow;

        _db.LeaveRequestEvents.Add(new LeaveRequestEvent
        {
            LeaveRequestId = req.Id,
            Action = "cancelled",
            ActorId = userId,
            Note = "Cancelled by employee.",
            At = DateTime.UtcNow
        });

        _db.AuditLogs.Add(new AuditLog
        {
            CompanyId = companyId,
            ActorName = req.User?.Name ?? "Employee",
            ActorEmail = req.User?.Email ?? "",
            Action = "UPDATE",
            EntityType = "LeaveRequest",
            EntityId = req.Id.ToString(),
            Details = $"Cancelled leave request #{req.Id}.",
            Timestamp = DateTime.UtcNow
        });

        // If approved, notify admins
        if (wasApproved)
        {
            var admins = await _db.Users
                .Include(u => u.Role)
                .Where(u => u.CompanyId == companyId &&
                            u.Role != null &&
                            (u.Role.Code == "company_admin" || u.Role.Code == "super_admin") &&
                            u.Status == UserStatus.Active)
                .ToListAsync(cancellationToken);

            var activeHandover = await _db.WorkHandovers
                .FirstOrDefaultAsync(wh => wh.CompanyId == companyId && wh.OriginalUserId == userId && wh.Status == "active", cancellationToken);

            foreach (var admin in admins)
            {
                if (activeHandover != null)
                {
                    _db.Notifications.Add(new Notification
                    {
                        CompanyId = companyId,
                        UserId = admin.Id,
                        Title = "Leave Cancelled - Handover Active",
                        Message = $"{req.User?.Name ?? "Employee"} cancelled their leave ({req.StartDate:d MMM} - {req.EndDate:d MMM}) but work handover #{activeHandover.Id} is still active. Please review it in Work Handover.",
                        Type = "warning",
                        IsRead = false,
                        CreatedAt = DateTime.UtcNow
                    });
                }
                else
                {
                    _db.Notifications.Add(new Notification
                    {
                        CompanyId = companyId,
                        UserId = admin.Id,
                        Title = "Approved Leave Cancelled",
                        Message = $"{req.User?.Name ?? "Employee"} has cancelled their approved {req.LeaveType} leave ({req.StartDate:d MMM} - {req.EndDate:d MMM}).",
                        Type = "info",
                        IsRead = false,
                        CreatedAt = DateTime.UtcNow
                    });
                }
            }
        }

        await _db.SaveChangesAsync(cancellationToken);

        return await GetSingleDto(companyId, req.Id, cancellationToken);
    }

    public async Task<ApiResponse<LeaveRequestDto>> ApproveLeaveRequestAsync(int companyId, int adminId, int leaveRequestId, ApproveLeaveRequestDto dto, CancellationToken cancellationToken = default)
    {
        var req = await _db.LeaveRequests
            .Include(lr => lr.User)
            .FirstOrDefaultAsync(lr => lr.Id == leaveRequestId && lr.CompanyId == companyId, cancellationToken);

        if (req == null)
            return ApiResponse<LeaveRequestDto>.FailureResult("Leave request not found.");

        if (req.Status != "Pending")
            return ApiResponse<LeaveRequestDto>.FailureResult("Leave request is already processed.");

        // Check if user has another approved leave overlapping these dates
        var hasOverlap = await _db.LeaveRequests.AnyAsync(lr =>
            lr.CompanyId == companyId &&
            lr.UserId == req.UserId &&
            lr.Id != req.Id &&
            lr.Status == "Approved" &&
            lr.StartDate <= req.EndDate &&
            req.StartDate <= lr.EndDate,
            cancellationToken);

        if (hasOverlap)
            return ApiResponse<LeaveRequestDto>.FailureResult("Employee already has another Approved leave request overlapping these dates.");

        var adminUser = await _db.Users.FindAsync(new object[] { adminId }, cancellationToken);

        // Spec §1 & §2: Approve ONLY changes leave status. NO work moves. NO StartHandoverAsync call!
        req.Status = "Approved";
        req.ApprovedById = adminId;
        req.DecidedById = adminId;
        req.DecisionAt = DateTime.UtcNow;
        req.DecisionNote = dto?.Note;
        req.HandoverDecision = "pending"; // handover state is not_arranged
        req.UpdatedAt = DateTime.UtcNow;

        _db.LeaveRequestEvents.Add(new LeaveRequestEvent
        {
            LeaveRequestId = req.Id,
            Action = "approved",
            ActorId = adminId,
            Note = dto?.Note,
            At = DateTime.UtcNow
        });

        _db.AuditLogs.Add(new AuditLog
        {
            CompanyId = companyId,
            ActorName = adminUser?.Name ?? "Admin",
            ActorEmail = adminUser?.Email ?? "",
            Action = "APPROVE",
            EntityType = "LeaveRequest",
            EntityId = req.Id.ToString(),
            Details = $"Approved {req.LeaveType} leave for {req.User?.Name} ({req.StartDate} to {req.EndDate}). Handover not arranged.",
            Timestamp = DateTime.UtcNow
        });

        // Notify requester
        _db.Notifications.Add(new Notification
        {
            CompanyId = companyId,
            UserId = req.UserId,
            Title = "Leave Request Approved",
            Message = $"Your {req.LeaveType} leave ({req.StartDate:d MMM} - {req.EndDate:d MMM}) was approved by {adminUser?.Name ?? "Admin"}.{(string.IsNullOrWhiteSpace(dto?.Note) ? "" : $" Note: {dto.Note}")}",
            Type = "success",
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync(cancellationToken);

        return await GetSingleDto(companyId, req.Id, cancellationToken);
    }

    public async Task<ApiResponse<LeaveRequestDto>> RejectLeaveRequestAsync(int companyId, int adminId, int leaveRequestId, RejectLeaveRequestDto dto, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(dto?.Reason))
            return ApiResponse<LeaveRequestDto>.FailureResult("Rejection reason is required.");

        var req = await _db.LeaveRequests
            .Include(lr => lr.User)
            .FirstOrDefaultAsync(lr => lr.Id == leaveRequestId && lr.CompanyId == companyId, cancellationToken);

        if (req == null)
            return ApiResponse<LeaveRequestDto>.FailureResult("Leave request not found.");

        if (req.Status != "Pending")
            return ApiResponse<LeaveRequestDto>.FailureResult("Leave request is already processed.");

        var adminUser = await _db.Users.FindAsync(new object[] { adminId }, cancellationToken);

        req.Status = "Rejected";
        req.DecidedById = adminId;
        req.DecisionAt = DateTime.UtcNow;
        req.DecisionNote = dto.Reason.Trim();
        req.UpdatedAt = DateTime.UtcNow;

        _db.LeaveRequestEvents.Add(new LeaveRequestEvent
        {
            LeaveRequestId = req.Id,
            Action = "rejected",
            ActorId = adminId,
            Note = req.DecisionNote,
            At = DateTime.UtcNow
        });

        _db.AuditLogs.Add(new AuditLog
        {
            CompanyId = companyId,
            ActorName = adminUser?.Name ?? "Admin",
            ActorEmail = adminUser?.Email ?? "",
            Action = "REJECT",
            EntityType = "LeaveRequest",
            EntityId = req.Id.ToString(),
            Details = $"Rejected {req.LeaveType} leave for {req.User?.Name}: {req.DecisionNote}",
            Timestamp = DateTime.UtcNow
        });

        _db.Notifications.Add(new Notification
        {
            CompanyId = companyId,
            UserId = req.UserId,
            Title = "Leave Request Rejected",
            Message = $"Your {req.LeaveType} leave request was rejected: {req.DecisionNote}",
            Type = "error",
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync(cancellationToken);

        return await GetSingleDto(companyId, req.Id, cancellationToken);
    }

    public async Task<ApiResponse<LeaveRequestDto>> MarkHandoverNotNeededAsync(int companyId, int adminId, int leaveRequestId, HandoverNotNeededDto dto, CancellationToken cancellationToken = default)
    {
        var req = await _db.LeaveRequests
            .Include(lr => lr.User)
            .FirstOrDefaultAsync(lr => lr.Id == leaveRequestId && lr.CompanyId == companyId, cancellationToken);

        if (req == null)
            return ApiResponse<LeaveRequestDto>.FailureResult("Leave request not found.");

        if (req.Status != "Approved")
            return ApiResponse<LeaveRequestDto>.FailureResult("Only approved leaves can be updated with handover decision.");

        var adminUser = await _db.Users.FindAsync(new object[] { adminId }, cancellationToken);

        req.HandoverDecision = "not_needed";
        req.HandoverDecisionNote = dto?.Note?.Trim();
        req.UpdatedAt = DateTime.UtcNow;

        _db.LeaveRequestEvents.Add(new LeaveRequestEvent
        {
            LeaveRequestId = req.Id,
            Action = "handover_not_needed",
            ActorId = adminId,
            Note = dto?.Note ?? "Handover marked as not needed.",
            At = DateTime.UtcNow
        });

        _db.AuditLogs.Add(new AuditLog
        {
            CompanyId = companyId,
            ActorName = adminUser?.Name ?? "Admin",
            ActorEmail = adminUser?.Email ?? "",
            Action = "UPDATE",
            EntityType = "LeaveRequest",
            EntityId = req.Id.ToString(),
            Details = $"Marked handover as not needed for leave #{req.Id}.",
            Timestamp = DateTime.UtcNow
        });

        await _db.SaveChangesAsync(cancellationToken);

        return await GetSingleDto(companyId, req.Id, cancellationToken);
    }

    private async Task<ApiResponse<LeaveRequestDto>> GetSingleDto(int companyId, int id, CancellationToken ct)
    {
        var req = await _db.LeaveRequests
            .Include(lr => lr.User)
                .ThenInclude(u => u!.Role)
            .Include(lr => lr.ApprovedBy)
            .Include(lr => lr.DecidedBy)
            .Include(lr => lr.CancelledBy)
            .FirstOrDefaultAsync(lr => lr.Id == id && lr.CompanyId == companyId, ct);

        if (req == null)
            return ApiResponse<LeaveRequestDto>.FailureResult("Leave request not found.");

        var handovers = await _db.WorkHandovers
            .Include(wh => wh.CoveringUser)
            .Where(wh => wh.CompanyId == companyId && wh.OriginalUserId == req.UserId)
            .ToListAsync(ct);

        return ApiResponse<LeaveRequestDto>.SuccessResult(MapToDto(req, handovers));
    }

    private static LeaveRequestDto MapToDto(LeaveRequest lr, List<WorkHandover> userHandovers)
    {
        string handoverState;
        int? coveringUserId = null;
        string? coveringUserName = null;
        int? workHandoverId = lr.WorkHandoverId;

        if (lr.Status != "Approved")
        {
            handoverState = lr.HandoverDecision == "not_needed" ? "not_needed" : "not_arranged";
        }
        else
        {
            // Check active handovers linked by LeaveRequestId or overlapping period
            var activeHandover = userHandovers.FirstOrDefault(wh =>
                wh.Status == "active" &&
                (wh.LeaveRequestId == lr.Id ||
                 (wh.Id == lr.WorkHandoverId && lr.WorkHandoverId != null) ||
                 (DateOnly.FromDateTime(wh.StartedAt) <= lr.EndDate && lr.StartDate <= (wh.PlannedEndAt.HasValue ? DateOnly.FromDateTime(wh.PlannedEndAt.Value) : DateOnly.MaxValue))));

            if (activeHandover != null)
            {
                handoverState = "covered";
                coveringUserId = activeHandover.CoveringUserId;
                coveringUserName = activeHandover.CoveringUser?.Name ?? $"User #{activeHandover.CoveringUserId}";
                workHandoverId = activeHandover.Id;
            }
            else
            {
                var endedHandover = userHandovers.FirstOrDefault(wh =>
                    wh.Status == "ended" &&
                    (wh.LeaveRequestId == lr.Id ||
                     (wh.Id == lr.WorkHandoverId && lr.WorkHandoverId != null) ||
                     (DateOnly.FromDateTime(wh.StartedAt) <= lr.EndDate && lr.StartDate <= (wh.PlannedEndAt.HasValue ? DateOnly.FromDateTime(wh.PlannedEndAt.Value) : DateOnly.MaxValue))));

                if (endedHandover != null)
                {
                    handoverState = "returned";
                    coveringUserId = endedHandover.CoveringUserId;
                    coveringUserName = endedHandover.CoveringUser?.Name;
                    workHandoverId = endedHandover.Id;
                }
                else if (lr.HandoverDecision == "not_needed")
                {
                    handoverState = "not_needed";
                }
                else
                {
                    handoverState = "not_arranged";
                }
            }
        }

        return new LeaveRequestDto
        {
            Id = lr.Id,
            CompanyId = lr.CompanyId,
            UserId = lr.UserId,
            UserName = lr.User?.Name ?? "",
            UserRole = lr.User?.Role?.Name ?? "Sales Executive",
            LeaveType = lr.LeaveType,
            StartDate = lr.StartDate,
            EndDate = lr.EndDate,
            IsHalfDay = lr.IsHalfDay,
            HalfDaySession = lr.HalfDaySession,
            Days = lr.Days,
            Reason = lr.Reason,
            Status = lr.Status,
            WorkHandoverId = workHandoverId,
            ApprovedById = lr.ApprovedById,
            ApprovedByName = lr.ApprovedBy?.Name,
            DecidedById = lr.DecidedById,
            DecidedByName = lr.DecidedBy?.Name,
            DecisionAt = lr.DecisionAt,
            DecisionNote = lr.DecisionNote,
            CancelledById = lr.CancelledById,
            CancelledByName = lr.CancelledBy?.Name,
            CancelledAt = lr.CancelledAt,
            HandoverDecision = lr.HandoverDecision,
            HandoverDecisionNote = lr.HandoverDecisionNote,
            HandoverState = handoverState,
            CoveringUserId = coveringUserId,
            CoveringUserName = coveringUserName,
            CreatedAt = lr.CreatedAt
        };
    }
}
