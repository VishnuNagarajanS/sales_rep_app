using backend.DTOs.Common;
using backend.DTOs.Irm;
using backend.Models.Entities;
using backend.Models.Enums;
using backend.Repositories.Interfaces;
using backend.Services.Interfaces;

namespace backend.Services.Implementations;

public class IrmFollowupService : IIrmFollowupService
{
    private readonly IFollowupRepository _followupRepo;
    private readonly IInvestorRepository _investorRepo;
    private readonly IUserRepository _userRepo;

    public IrmFollowupService(IFollowupRepository followupRepo, IInvestorRepository investorRepo, IUserRepository userRepo)
    {
        _followupRepo = followupRepo;
        _investorRepo = investorRepo;
        _userRepo = userRepo;
    }

    public async Task<ApiResponse<List<FollowupDto>>> GetAllAsync(int companyId, int? assignedToId, string? status, CancellationToken ct = default)
    {
        var list = await _followupRepo.GetAllAsync(companyId, assignedToId, "irm", status, ct);
        return ApiResponse<List<FollowupDto>>.SuccessResponse(list.Select(MapToDto).ToList());
    }

    public async Task<ApiResponse<FollowupDto>> CreateAsync(int companyId, int assignedToId, string assignedToRole, CreateFollowupDto dto, CancellationToken ct = default)
    {
        var user = await _userRepo.GetByIdAsync(assignedToId, ct);

        // Deduplication & idempotency check
        var allCompanyFollowups = await _followupRepo.GetAllAsync(companyId, null, null, null, ct);
        var fDigits = (dto.ContactPhone ?? string.Empty).Replace(" ", "").Replace("-", "");
        if (fDigits.Length > 10) fDigits = fDigits[^10..];

        var existingPending = allCompanyFollowups.FirstOrDefault(f =>
            f.Status == FollowupStatus.Pending &&
            ((!string.IsNullOrEmpty(dto.ContactId) && f.ContactId == dto.ContactId) ||
             (!string.IsNullOrEmpty(fDigits) && f.ContactPhone != null && f.ContactPhone.Contains(fDigits))));

        if (existingPending != null)
        {
            existingPending.ScheduledAt = dto.ScheduledAt;
            existingPending.Agenda = dto.Agenda;
            existingPending.AssignedToId = assignedToId;
            existingPending.AssignedToName = user?.Name ?? string.Empty;
            existingPending.AssignedToRole = assignedToRole;
            var updatedExisting = await _followupRepo.UpdateAsync(existingPending, ct);
            return ApiResponse<FollowupDto>.SuccessResponse(MapToDto(updatedExisting), "Existing pending follow-up updated.");
        }

        string? investorName = null;
        if (dto.InvestorId.HasValue)
        {
            var investor = await _investorRepo.GetByIdAsync(dto.InvestorId.Value, companyId, ct);
            investorName = investor?.Name;
        }

        var followup = new Followup
        {
            CompanyId = companyId,
            InvestorId = dto.InvestorId,
            InvestorName = investorName,
            AssignedToId = assignedToId,
            AssignedToName = user?.Name ?? string.Empty,
            AssignedToRole = assignedToRole,
            ContactName = dto.ContactName,
            ContactPhone = dto.ContactPhone,
            ContactId = dto.ContactId ?? string.Empty,
            ScheduledAt = dto.ScheduledAt,
            Status = FollowupStatus.Pending,
            Agenda = dto.Agenda,
            CreatedAt = DateTime.UtcNow
        };

        var created = await _followupRepo.CreateAsync(followup, ct);
        return ApiResponse<FollowupDto>.SuccessResponse(MapToDto(created), "Followup created successfully");
    }

    public async Task<ApiResponse<FollowupDto>> CompleteAsync(int id, int companyId, CompleteFollowupDto dto, CancellationToken ct = default)
    {
        var f = await _followupRepo.GetByIdAsync(id, companyId, ct);
        if (f == null)
            return ApiResponse<FollowupDto>.ErrorResponse("Followup not found");

        f.Status = FollowupStatus.Completed;
        f.CompletedAt = DateTime.UtcNow;
        f.OutcomeNotes = dto.OutcomeNotes;

        var updated = await _followupRepo.UpdateAsync(f, ct);
        return ApiResponse<FollowupDto>.SuccessResponse(MapToDto(updated), "Followup marked as completed");
    }

    public async Task<ApiResponse<FollowupDto>> RescheduleAsync(int id, int companyId, RescheduleFollowupDto dto, CancellationToken ct = default)
    {
        var f = await _followupRepo.GetByIdAsync(id, companyId, ct);
        if (f == null)
            return ApiResponse<FollowupDto>.ErrorResponse("Followup not found");

        f.ScheduledAt = dto.NewScheduledAt;
        f.RescheduledTo = dto.NewScheduledAt;
        f.Status = FollowupStatus.Rescheduled;
        if (!string.IsNullOrWhiteSpace(dto.Reason))
        {
            f.OutcomeNotes = $"Rescheduled reason: {dto.Reason}";
        }

        var updated = await _followupRepo.UpdateAsync(f, ct);
        return ApiResponse<FollowupDto>.SuccessResponse(MapToDto(updated), "Followup rescheduled");
    }

    private static FollowupDto MapToDto(Followup f) => new()
    {
        Id = f.Id,
        CompanyId = f.CompanyId,
        InvestorId = f.InvestorId,
        InvestorName = f.InvestorName,
        AssignedToId = f.AssignedToId,
        AssignedToName = f.AssignedToName,
        AssignedToRole = f.AssignedToRole,
        ContactName = f.ContactName,
        ContactPhone = f.ContactPhone,
        ContactId = f.ContactId,
        ScheduledAt = f.ScheduledAt,
        Status = f.Status.ToString(),
        Agenda = f.Agenda,
        OutcomeNotes = f.OutcomeNotes,
        CreatedAt = f.CreatedAt,
        CompletedAt = f.CompletedAt,
        RescheduledTo = f.RescheduledTo
    };
}
