using backend.DTOs.Common;
using backend.DTOs.Irm;
using backend.Models.Entities;
using backend.Models.Enums;
using backend.Repositories.Interfaces;
using backend.Services.Interfaces;

namespace backend.Services.Implementations;

public class ConsultationService : IConsultationService
{
    private readonly IConsultationRepository _consultationRepo;
    private readonly IInvestorRepository _investorRepo;
    private readonly IUserRepository _userRepo;

    public ConsultationService(IConsultationRepository consultationRepo, IInvestorRepository investorRepo, IUserRepository userRepo)
    {
        _consultationRepo = consultationRepo;
        _investorRepo = investorRepo;
        _userRepo = userRepo;
    }

    public async Task<ApiResponse<List<ConsultationDto>>> GetAllAsync(int companyId, int? consultantId, string? status, DateTime? from, DateTime? to, CancellationToken ct = default)
    {
        var list = await _consultationRepo.GetAllAsync(companyId, consultantId, status, from, to, ct);
        return ApiResponse<List<ConsultationDto>>.SuccessResponse(list.Select(MapToDto).ToList());
    }

    public async Task<ApiResponse<ConsultationDto>> GetByIdAsync(int id, int companyId, CancellationToken ct = default)
    {
        var c = await _consultationRepo.GetByIdAsync(id, companyId, ct);
        if (c == null)
            return ApiResponse<ConsultationDto>.ErrorResponse("Consultation not found");

        return ApiResponse<ConsultationDto>.SuccessResponse(MapToDto(c));
    }

    public async Task<ApiResponse<ConsultationDto>> CreateAsync(int companyId, int consultantId, CreateConsultationDto dto, CancellationToken ct = default)
    {
        var user = await _userRepo.GetByIdAsync(consultantId, ct);
        var investor = await _investorRepo.GetByIdAsync(dto.InvestorId, companyId, ct);

        var consultation = new Consultation
        {
            InvestorId = dto.InvestorId,
            CompanyId = companyId,
            ConsultantId = consultantId,
            ConsultantName = user?.Name ?? string.Empty,
            InvestorName = investor?.Name ?? dto.InvestorName,
            InvestorPhone = investor?.Phone ?? dto.InvestorPhone,
            ScheduledAt = dto.ScheduledAt,
            Status = ConsultationStatus.Scheduled,
            Agenda = dto.Agenda,
            ReferredByAgentName = dto.ReferredByAgentName,
            CreatedAt = DateTime.UtcNow
        };

        var created = await _consultationRepo.CreateAsync(consultation, ct);
        return ApiResponse<ConsultationDto>.SuccessResponse(MapToDto(created), "Consultation scheduled successfully");
    }

    public async Task<ApiResponse<ConsultationDto>> UpdateAsync(int id, int companyId, UpdateConsultationDto dto, CancellationToken ct = default)
    {
        var c = await _consultationRepo.GetByIdAsync(id, companyId, ct);
        if (c == null)
            return ApiResponse<ConsultationDto>.ErrorResponse("Consultation not found");

        if (dto.ScheduledAt.HasValue)
        {
            c.ScheduledAt = dto.ScheduledAt.Value;
            c.Status = ConsultationStatus.Rescheduled;
        }

        if (!string.IsNullOrWhiteSpace(dto.Status) && Enum.TryParse<ConsultationStatus>(dto.Status, true, out var parsedStatus))
        {
            c.Status = parsedStatus;
        }

        if (!string.IsNullOrWhiteSpace(dto.Agenda))
            c.Agenda = dto.Agenda;

        var updated = await _consultationRepo.UpdateAsync(c, ct);
        return ApiResponse<ConsultationDto>.SuccessResponse(MapToDto(updated), "Consultation updated successfully");
    }

    public async Task<ApiResponse<ConsultationDto>> RecordOutcomeAsync(int id, int companyId, ConsultationOutcomeDto dto, CancellationToken ct = default)
    {
        var c = await _consultationRepo.GetByIdAsync(id, companyId, ct);
        if (c == null)
            return ApiResponse<ConsultationDto>.ErrorResponse("Consultation not found");

        c.OutcomeNotes = dto.OutcomeNotes;
        if (Enum.TryParse<ConsultationStatus>(dto.Status, true, out var parsedStatus))
        {
            c.Status = parsedStatus;
        }
        else
        {
            c.Status = ConsultationStatus.Completed;
        }

        var updated = await _consultationRepo.UpdateAsync(c, ct);
        return ApiResponse<ConsultationDto>.SuccessResponse(MapToDto(updated), "Consultation outcome recorded");
    }

    public async Task<ApiResponse<bool>> DeleteAsync(int id, int companyId, CancellationToken ct = default)
    {
        var c = await _consultationRepo.GetByIdAsync(id, companyId, ct);
        if (c == null)
            return ApiResponse<bool>.ErrorResponse("Consultation not found");

        await _consultationRepo.DeleteAsync(id, ct);
        return ApiResponse<bool>.SuccessResponse(true, "Consultation cancelled successfully");
    }

    private static ConsultationDto MapToDto(Consultation c) => new()
    {
        Id = c.Id,
        InvestorId = c.InvestorId,
        CompanyId = c.CompanyId,
        ConsultantId = c.ConsultantId,
        ConsultantName = c.ConsultantName,
        InvestorName = c.InvestorName,
        InvestorPhone = c.InvestorPhone,
        ScheduledAt = c.ScheduledAt,
        Status = c.Status.ToString(),
        Agenda = c.Agenda,
        OutcomeNotes = c.OutcomeNotes,
        ReferredByAgentName = c.ReferredByAgentName,
        CreatedAt = c.CreatedAt,
        UpdatedAt = c.UpdatedAt
    };
}
