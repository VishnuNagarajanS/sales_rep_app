using backend.DTOs.Common;
using backend.DTOs.Irm;
using backend.Models.Entities;
using backend.Models.Enums;
using backend.Repositories.Interfaces;
using backend.Services.Interfaces;

namespace backend.Services.Implementations;

public class InvestorCallService : IInvestorCallService
{
    private readonly IInvestorCallRepository _callRepo;
    private readonly IUserRepository _userRepo;

    public InvestorCallService(IInvestorCallRepository callRepo, IUserRepository userRepo)
    {
        _callRepo = callRepo;
        _userRepo = userRepo;
    }

    public async Task<ApiResponse<List<CallLogDto>>> GetAllAsync(int companyId, int? irmId, CancellationToken ct = default)
    {
        var calls = await _callRepo.GetAllAsync(companyId, irmId, ct);
        return ApiResponse<List<CallLogDto>>.SuccessResponse(calls.Select(MapToDto).ToList());
    }

    public async Task<ApiResponse<CallLogDto>> GetByIdAsync(int id, int companyId, int? userId, string role, CancellationToken ct = default)
    {
        var call = await _callRepo.GetByIdAsync(id, ct);
        if (call == null)
        {
            return ApiResponse<CallLogDto>.ErrorResponse("Call record not found.");
        }

        if (role != "super_admin" && call.CompanyId != companyId)
        {
            return ApiResponse<CallLogDto>.ErrorResponse("Access denied: You cannot access calls from another company.");
        }

        if (role == "irm" && userId.HasValue && call.IrmId != userId.Value)
        {
            return ApiResponse<CallLogDto>.ErrorResponse("Access denied: You are only authorized to view your own call records.");
        }

        return ApiResponse<CallLogDto>.SuccessResponse(MapToDto(call));
    }

    public async Task<ApiResponse<CallLogDto>> LogCallAsync(int companyId, int irmId, LogCallDto dto, CancellationToken ct = default)
    {
        var user = await _userRepo.GetByIdAsync(irmId, ct);

        var callOutcome = CallOutcome.Interested;
        if (Enum.TryParse<CallOutcome>(dto.Outcome, true, out var parsedOutcome))
        {
            callOutcome = parsedOutcome;
        }

        var call = new InvestorCall
        {
            InvestorId = dto.InvestorId,
            CompanyId = companyId,
            IrmId = irmId,
            IrmName = user?.Name ?? string.Empty,
            InvestorName = dto.InvestorName,
            InvestorPhone = dto.InvestorPhone,
            CalledAt = DateTime.UtcNow,
            DurationSeconds = dto.DurationSeconds,
            Outcome = callOutcome,
            Notes = dto.Notes,
            RecordingUrl = dto.RecordingUrl
        };

        var created = await _callRepo.CreateAsync(call, ct);
        return ApiResponse<CallLogDto>.SuccessResponse(MapToDto(created), "Call logged successfully");
    }

    private static CallLogDto MapToDto(InvestorCall c) => new()
    {
        Id = c.Id,
        InvestorId = c.InvestorId,
        InvestorName = c.InvestorName,
        InvestorPhone = c.InvestorPhone,
        IrmId = c.IrmId,
        IrmName = c.IrmName,
        CalledAt = c.CalledAt,
        DurationSeconds = c.DurationSeconds,
        Outcome = c.Outcome.ToString(),
        Notes = c.Notes,
        RecordingUrl = c.RecordingUrl
    };
}
