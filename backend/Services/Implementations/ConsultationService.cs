using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.Consultations;
using backend.Models.Entities;
using backend.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Implementations;

public sealed class ConsultationService(ApplicationDbContext context, ICurrentUserService currentUser) : IConsultationService
{
    public async Task<ApiResponse<PagedResult<ConsultationResponseDto>>> GetConsultationsAsync(string? status, string? search, int page, int pageSize, CancellationToken ct)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var query = ScopedQuery();
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(x => x.Status == status);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(x => x.InvestorName.Contains(term) || x.InvestorPhone.Contains(term) || x.Agenda.Contains(term));
        }

        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => Map(x))
            .ToListAsync(ct);

        return ApiResponse<PagedResult<ConsultationResponseDto>>.SuccessResult(
            PagedResult<ConsultationResponseDto>.Create(items, total, page, pageSize),
            "Consultations retrieved successfully.");
    }

    public async Task<ApiResponse<ConsultationResponseDto>> GetConsultationByIdAsync(int id, CancellationToken ct)
    {
        var consultation = await ScopedQuery().AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        return consultation == null
            ? ApiResponse<ConsultationResponseDto>.FailureResult("Consultation not found.")
            : ApiResponse<ConsultationResponseDto>.SuccessResult(Map(consultation));
    }

    public async Task<ApiResponse<ConsultationResponseDto>> ScheduleConsultationAsync(ScheduleConsultationDto dto, CancellationToken ct)
    {
        var consultation = new Consultation
        {
            CompanyId = currentUser.CompanyId,
            InvestorId = dto.InvestorId.Trim(),
            InvestorName = dto.InvestorName.Trim(),
            InvestorPhone = dto.InvestorPhone.Trim(),
            ConsultantId = currentUser.RoleCode == "sales_executive" ? currentUser.UserId.ToString() : dto.ConsultantId.Trim(),
            ConsultantName = currentUser.RoleCode == "sales_executive" ? string.Empty : dto.ConsultantName.Trim(),
            ScheduledAt = dto.ScheduledAt.Trim(),
            Status = dto.Status.Trim(),
            Agenda = dto.Agenda.Trim(),
            OutcomeNotes = dto.OutcomeNotes?.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        context.Consultations.Add(consultation);
        await context.SaveChangesAsync(ct);
        return ApiResponse<ConsultationResponseDto>.SuccessResult(Map(consultation), "Consultation scheduled successfully.");
    }

    public async Task<ApiResponse<ConsultationResponseDto>> UpdateConsultationAsync(int id, UpdateConsultationDto dto, CancellationToken ct)
    {
        var consultation = await ScopedQuery().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (consultation == null) return ApiResponse<ConsultationResponseDto>.FailureResult("Consultation not found.");

        consultation.InvestorId = dto.InvestorId.Trim();
        consultation.InvestorName = dto.InvestorName.Trim();
        consultation.InvestorPhone = dto.InvestorPhone.Trim();
        consultation.ConsultantId = currentUser.RoleCode == "sales_executive" ? currentUser.UserId.ToString() : dto.ConsultantId.Trim();
        consultation.ConsultantName = currentUser.RoleCode == "sales_executive" ? consultation.ConsultantName : dto.ConsultantName.Trim();
        consultation.ScheduledAt = dto.ScheduledAt.Trim();
        consultation.Status = dto.Status.Trim();
        consultation.Agenda = dto.Agenda.Trim();
        consultation.OutcomeNotes = dto.OutcomeNotes?.Trim();
        consultation.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(ct);
        return ApiResponse<ConsultationResponseDto>.SuccessResult(Map(consultation), "Consultation updated successfully.");
    }

    public async Task<ApiResponse<bool>> DeleteConsultationAsync(int id, CancellationToken ct)
    {
        var consultation = await ScopedQuery().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (consultation == null) return ApiResponse<bool>.FailureResult("Consultation not found.");
        context.Consultations.Remove(consultation);
        await context.SaveChangesAsync(ct);
        return ApiResponse<bool>.SuccessResult(true, "Consultation deleted successfully.");
    }

    private IQueryable<Consultation> ScopedQuery()
    {
        var query = context.Consultations.Where(x => x.CompanyId == currentUser.CompanyId);
        return currentUser.RoleCode == "sales_executive"
            ? query.Where(x => x.ConsultantId == currentUser.UserId.ToString())
            : query;
    }

    private static ConsultationResponseDto Map(Consultation x) => new()
    {
        Id = x.Id,
        CompanyId = x.CompanyId,
        InvestorId = x.InvestorId,
        InvestorName = x.InvestorName,
        InvestorPhone = x.InvestorPhone,
        ConsultantId = x.ConsultantId,
        ConsultantName = x.ConsultantName,
        ScheduledAt = x.ScheduledAt,
        Status = x.Status,
        Agenda = x.Agenda,
        OutcomeNotes = x.OutcomeNotes,
        CreatedAt = x.CreatedAt,
        UpdatedAt = x.UpdatedAt
    };
}
