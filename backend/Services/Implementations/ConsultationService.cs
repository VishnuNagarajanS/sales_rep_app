using backend.Authentication.Interfaces;
using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.Consultations;
using backend.Models.Entities;
using backend.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Implementations;

public class ConsultationService : IConsultationService
{
    private readonly ApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public ConsultationService(ApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    private IQueryable<Consultation> GetScopedConsultationsQuery()
    {
        var role = _currentUser.Role;
        var consultantId = _currentUser.UserId;
        var companyId = _currentUser.CompanyId;

        var query = _context.Consultations.AsNoTracking().Include(c => c.Consultant).AsQueryable();

        if (role == "super_admin")
        {
            if (companyId.HasValue)
                query = query.Where(c => c.CompanyId == companyId.Value);
            return query;
        }

        if (companyId.HasValue)
        {
            query = query.Where(c => c.CompanyId == companyId.Value);
        }

        if (role == "sales_executive" && consultantId.HasValue)
        {
            query = query.Where(c => c.ConsultantId == consultantId.Value);
        }

        return query;
    }

    private async Task<Consultation?> FindScopedConsultationAsync(int id, CancellationToken ct)
    {
        var role = _currentUser.Role;
        var consultantId = _currentUser.UserId;
        var companyId = _currentUser.CompanyId;

        var query = _context.Consultations.Include(c => c.Consultant).Where(c => c.Id == id);

        if (role == "super_admin")
        {
            return await query.FirstOrDefaultAsync(ct);
        }

        if (companyId.HasValue)
        {
            query = query.Where(c => c.CompanyId == companyId.Value);
        }

        if (role == "sales_executive" && consultantId.HasValue)
        {
            query = query.Where(c => c.ConsultantId == consultantId.Value);
        }

        return await query.FirstOrDefaultAsync(ct);
    }

    public async Task<ApiResponse<PagedResult<ConsultationResponseDto>>> GetConsultationsAsync(string? status, string? search, int page = 1, int pageSize = 10, CancellationToken ct = default)
    {
        var query = GetScopedConsultationsQuery();

        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(c => c.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(c => c.InvestorName.ToLower().Contains(s) || c.InvestorPhone.Contains(s));
        }

        var totalCount = await query.CountAsync(ct);

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var entities = await query
            .OrderByDescending(c => c.ScheduledAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var items = entities.Select(MapToDto).ToList();

        return ApiResponse<PagedResult<ConsultationResponseDto>>.SuccessResult(
            PagedResult<ConsultationResponseDto>.Create(items, totalCount, page, pageSize),
            "Consultations retrieved successfully.");
    }

    public async Task<ApiResponse<ConsultationResponseDto>> GetConsultationByIdAsync(int id, CancellationToken ct = default)
    {
        var consultation = await FindScopedConsultationAsync(id, ct);
        if (consultation == null)
            return ApiResponse<ConsultationResponseDto>.FailureResult("Consultation not found or access denied.");

        return ApiResponse<ConsultationResponseDto>.SuccessResult(MapToDto(consultation));
    }

    public async Task<ApiResponse<ConsultationResponseDto>> ScheduleConsultationAsync(ScheduleConsultationDto dto, CancellationToken ct = default)
    {
        var consultantId = _currentUser.UserId ?? 1;
        var companyId = _currentUser.CompanyId ?? 1;

        var consultation = new Consultation
        {
            CompanyId = companyId,
            ConsultantId = consultantId,
            InvestorId = dto.InvestorId.Trim(),
            InvestorName = dto.InvestorName.Trim(),
            InvestorPhone = dto.InvestorPhone.Trim(),
            ScheduledAt = dto.ScheduledAt,
            Status = "Scheduled",
            Agenda = dto.Agenda?.Trim() ?? string.Empty,
            OutcomeNotes = dto.Notes?.Trim() ?? string.Empty,
            CreatedAt = DateTime.UtcNow
        };

        _context.Consultations.Add(consultation);
        await _context.SaveChangesAsync(ct);

        await _context.Entry(consultation).Reference(c => c.Consultant).LoadAsync(ct);

        return ApiResponse<ConsultationResponseDto>.SuccessResult(MapToDto(consultation), "Consultation scheduled successfully.");
    }

    public async Task<ApiResponse<ConsultationResponseDto>> UpdateConsultationAsync(int id, UpdateConsultationDto dto, CancellationToken ct = default)
    {
        var consultation = await FindScopedConsultationAsync(id, ct);
        if (consultation == null)
            return ApiResponse<ConsultationResponseDto>.FailureResult("Consultation not found or access denied.");

        if (dto.ScheduledAt.HasValue) consultation.ScheduledAt = dto.ScheduledAt.Value;
        if (!string.IsNullOrWhiteSpace(dto.Status)) consultation.Status = dto.Status.Trim();
        if (dto.Agenda != null) consultation.Agenda = dto.Agenda.Trim();
        if (dto.OutcomeNotes != null) consultation.OutcomeNotes = dto.OutcomeNotes.Trim();

        consultation.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(ct);

        return ApiResponse<ConsultationResponseDto>.SuccessResult(MapToDto(consultation), "Consultation updated successfully.");
    }

    private static ConsultationResponseDto MapToDto(Consultation c)
    {
        return new ConsultationResponseDto
        {
            Id = c.Id,
            CompanyId = c.CompanyId,
            ConsultantId = c.ConsultantId,
            ConsultantName = c.Consultant?.Name,
            InvestorId = c.InvestorId,
            InvestorName = c.InvestorName,
            InvestorPhone = c.InvestorPhone,
            ScheduledAt = c.ScheduledAt,
            Status = c.Status,
            Agenda = c.Agenda,
            OutcomeNotes = c.OutcomeNotes,
            CreatedAt = c.CreatedAt,
            UpdatedAt = c.UpdatedAt
        };
    }
}
