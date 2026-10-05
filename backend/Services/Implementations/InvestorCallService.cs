using backend.DTOs.Common;
using backend.DTOs.Irm;
using backend.Models.Entities;
using backend.Models.Enums;
using backend.Repositories.Interfaces;
using backend.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Implementations;

public class InvestorCallService : IInvestorCallService
{
    private readonly IInvestorCallRepository _callRepo;
    private readonly IUserRepository _userRepo;
    private readonly backend.Data.ApplicationDbContext _context;

    public InvestorCallService(IInvestorCallRepository callRepo, IUserRepository userRepo, backend.Data.ApplicationDbContext context)
    {
        _callRepo = callRepo;
        _userRepo = userRepo;
        _context = context;
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

        // Verify genuine carrier configuration
        var carrier = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.AsNoTracking(_context.CarrierSettings).FirstOrDefaultAsync(ct);
        bool hasCarrierCredentials = carrier != null &&
            !string.IsNullOrWhiteSpace(carrier.AccountSid) &&
            !string.IsNullOrWhiteSpace(carrier.AuthTokenEncrypted);

        int effectiveDuration = hasCarrierCredentials ? Math.Max(0, dto.DurationSeconds) : 0;

        var callOutcome = CallOutcome.Interested;
        if (Enum.TryParse<CallOutcome>(dto.Outcome, true, out var parsedOutcome))
        {
            callOutcome = parsedOutcome;
        }

        // If telephony trunk is offline or simulated, do not mark as connected or successful
        if (!hasCarrierCredentials && (callOutcome == CallOutcome.Interested || callOutcome == CallOutcome.MandateDiscussed))
        {
            callOutcome = CallOutcome.NoAnswer;
        }

        var notesBuilder = new System.Text.StringBuilder(dto.Notes ?? string.Empty);
        if (!hasCarrierCredentials)
        {
            if (notesBuilder.Length > 0) notesBuilder.Append(" ");
            notesBuilder.Append("[Provider Result: Simulated / Telephony Gateway Offline - Call not connected (0s)]");
        }

        // Ensure recording URL is genuine provider URL and not placeholder/sample
        string? recordingUrl = null;
        if (hasCarrierCredentials && !string.IsNullOrWhiteSpace(dto.RecordingUrl) && !dto.RecordingUrl.Contains("sample.mp3") && !dto.RecordingUrl.Contains("nexusplatform.io"))
        {
            recordingUrl = dto.RecordingUrl;
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
            DurationSeconds = effectiveDuration,
            Outcome = callOutcome,
            Notes = notesBuilder.ToString(),
            RecordingUrl = recordingUrl
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
