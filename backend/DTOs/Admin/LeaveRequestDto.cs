using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace backend.DTOs.Admin;

public class LeaveRequestDto
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public int UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string UserRole { get; set; } = string.Empty;
    public string LeaveType { get; set; } = "Casual";
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public bool IsHalfDay { get; set; }
    public string? HalfDaySession { get; set; }
    public decimal Days { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string Status { get; set; } = "Pending";
    public int? WorkHandoverId { get; set; }
    public int? ApprovedById { get; set; }
    public string? ApprovedByName { get; set; }
    public int? DecidedById { get; set; }
    public string? DecidedByName { get; set; }
    public DateTime? DecisionAt { get; set; }
    public string? DecisionNote { get; set; }
    public int? CancelledById { get; set; }
    public string? CancelledByName { get; set; }
    public DateTime? CancelledAt { get; set; }
    public string HandoverDecision { get; set; } = "pending";
    public string? HandoverDecisionNote { get; set; }
    public string HandoverState { get; set; } = "not_arranged"; // 'covered' | 'returned' | 'not_needed' | 'not_arranged'
    public int? CoveringUserId { get; set; }
    public string? CoveringUserName { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateLeaveRequestDto
{
    public string LeaveType { get; set; } = "Casual";
    [Required]
    public DateOnly StartDate { get; set; }
    [Required]
    public DateOnly EndDate { get; set; }
    public bool IsHalfDay { get; set; }
    public string? HalfDaySession { get; set; }
    public string Reason { get; set; } = string.Empty;
}

public class UpdateLeaveRequestDto
{
    public string LeaveType { get; set; } = "Casual";
    [Required]
    public DateOnly StartDate { get; set; }
    [Required]
    public DateOnly EndDate { get; set; }
    public bool IsHalfDay { get; set; }
    public string? HalfDaySession { get; set; }
    public string Reason { get; set; } = string.Empty;
}

public class ApproveLeaveRequestDto
{
    public string? Note { get; set; }
    // Optional / ignored if sent by legacy clients
    public int? CoveringUserId { get; set; }
}

public class RejectLeaveRequestDto
{
    [Required]
    public string Reason { get; set; } = string.Empty;
}

public class HandoverNotNeededDto
{
    public string? Note { get; set; }
}

public class LeaveBalanceDto
{
    public string LeaveType { get; set; } = string.Empty;
    public decimal Quota { get; set; }
    public decimal Used { get; set; }
    public decimal Pending { get; set; }
    public decimal Remaining { get; set; }
}

public class LeaveRequestEventDto
{
    public int Id { get; set; }
    public string Action { get; set; } = string.Empty;
    public int ActorId { get; set; }
    public string ActorName { get; set; } = string.Empty;
    public string? Note { get; set; }
    public DateTime At { get; set; }
}

public class LeaveRequestDetailDto : LeaveRequestDto
{
    public List<LeaveRequestEventDto> Events { get; set; } = new();
    public List<LeaveBalanceDto> RequesterBalances { get; set; } = new();
}

public class TeammateConflictDto
{
    public int UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string RoleCode { get; set; } = string.Empty;
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public decimal Days { get; set; }
    public string Status { get; set; } = string.Empty;
    public string LeaveType { get; set; } = string.Empty;
}

public class LeaveConflictsDto
{
    public bool HasConflict { get; set; }
    public decimal PercentageAway { get; set; }
    public bool IsHighAbsenceRate { get; set; }
    public List<TeammateConflictDto> Conflicts { get; set; } = new();
}

public class WorkforceAvailabilityDto
{
    public int UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string RoleCode { get; set; } = string.Empty;
    public bool OnLeave { get; set; }
    public DateOnly? LeaveUntil { get; set; }
    public int? LeaveRequestId { get; set; }
    public bool IsCovered { get; set; }
    public string? CoveredBy { get; set; }
}

public class CoverSuggestionDto
{
    public int UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string RoleCode { get; set; } = string.Empty;
    public int OpenItemCount { get; set; }
    public bool CurrentlyCovering { get; set; }
    public bool IsRecommended { get; set; }
    public bool Disabled { get; set; }
    public string? DisabledReason { get; set; }
}
