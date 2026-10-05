using backend.Authentication.Interfaces;
using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.Consultations;
using backend.DTOs.Irm;
using backend.Models.Entities;
using backend.Models.Enums;
using backend.Repositories.Interfaces;
using backend.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Implementations;

public class ConsultationService : IConsultationService
{
    private readonly ApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;
    private readonly IConsultationRepository _consultationRepo;
    private readonly IInvestorRepository _investorRepo;
    private readonly IUserRepository _userRepo;

    public ConsultationService(
        ApplicationDbContext context,
        ICurrentUserService currentUser,
        IConsultationRepository consultationRepo,
        IInvestorRepository investorRepo,
        IUserRepository userRepo)
    {
        _context = context;
        _currentUser = currentUser;
        _consultationRepo = consultationRepo;
        _investorRepo = investorRepo;
        _userRepo = userRepo;
    }

    // ── Sales Executive Scoped Queries & Methods ─────────────────────────────

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

        if (role == "sales_executive")
        {
            var agentName = _currentUser.Name;
            query = query.Where(c => (consultantId.HasValue && c.ConsultantId == consultantId.Value) || 
                                     (!string.IsNullOrEmpty(agentName) && c.ReferredByAgentName == agentName) ||
                                     c.CompanyId == (companyId ?? 1));
        }
        else if (role == "irm")
        {
            var agentName = _currentUser.Name;
            query = query.Where(c => (consultantId.HasValue && c.ConsultantId == consultantId.Value) ||
                                     (!string.IsNullOrEmpty(agentName) && c.ConsultantName == agentName) ||
                                     c.CompanyId == (companyId ?? 1));
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

        if (role == "sales_executive")
        {
            var agentName = _currentUser.Name;
            query = query.Where(c => (consultantId.HasValue && c.ConsultantId == consultantId.Value) || 
                                     (!string.IsNullOrEmpty(agentName) && c.ReferredByAgentName == agentName) ||
                                     c.CompanyId == (companyId ?? 1));
        }
        else if (role == "irm")
        {
            var agentName = _currentUser.Name;
            query = query.Where(c => (consultantId.HasValue && c.ConsultantId == consultantId.Value) ||
                                     (!string.IsNullOrEmpty(agentName) && c.ConsultantName == agentName) ||
                                     c.CompanyId == (companyId ?? 1));
        }

        return await query.FirstOrDefaultAsync(ct);
    }

    public async Task<ApiResponse<PagedResult<ConsultationResponseDto>>> GetConsultationsAsync(
        string? status, string? search, int page = 1, int pageSize = 10, CancellationToken ct = default)
    {
        var query = GetScopedConsultationsQuery();

        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            if (Enum.TryParse<ConsultationStatus>(status, true, out var parsedStatus))
            {
                query = query.Where(c => c.Status == parsedStatus);
            }
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

        var items = entities.Select(MapToSalesExecDto).ToList();

        return ApiResponse<PagedResult<ConsultationResponseDto>>.SuccessResult(
            PagedResult<ConsultationResponseDto>.Create(items, totalCount, page, pageSize),
            "Consultations retrieved successfully.");
    }

    public async Task<ApiResponse<ConsultationResponseDto>> GetConsultationByIdAsync(int id, CancellationToken ct = default)
    {
        var consultation = await FindScopedConsultationAsync(id, ct);
        if (consultation == null)
            return ApiResponse<ConsultationResponseDto>.FailureResult("Consultation not found or access denied.");

        return ApiResponse<ConsultationResponseDto>.SuccessResult(MapToSalesExecDto(consultation));
    }

    public async Task<ApiResponse<ConsultationResponseDto>> ScheduleConsultationAsync(
        ScheduleConsultationDto dto, CancellationToken ct = default)
    {
        var currentUserId = _currentUser.UserId ?? 1;
        var currentUserName = _currentUser.Name ?? "Sales Executive";
        var companyId = _currentUser.CompanyId ?? 1;

        // 1. Resolve Consultant (IRM)
        int consultantId = 0;
        string consultantName = dto.ConsultantName?.Trim() ?? string.Empty;

        if (dto.ConsultantId.HasValue && dto.ConsultantId.Value > 0)
        {
            var userById = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == dto.ConsultantId.Value, ct);
            if (userById != null)
            {
                consultantId = userById.Id;
                if (string.IsNullOrWhiteSpace(consultantName))
                    consultantName = userById.Name;
            }
        }

        if (consultantId == 0 && !string.IsNullOrWhiteSpace(consultantName))
        {
            var userByName = await _context.Users.AsNoTracking()
                .FirstOrDefaultAsync(u => u.Name.ToLower() == consultantName.ToLower() && (u.CompanyId == companyId || u.CompanyId == 1), ct);
            if (userByName != null)
            {
                consultantId = userByName.Id;
                consultantName = userByName.Name;
            }
        }

        if (consultantId == 0)
        {
            consultantId = currentUserId;
            if (string.IsNullOrWhiteSpace(consultantName))
                consultantName = currentUserName;
        }

        var referredBy = !string.IsNullOrWhiteSpace(dto.ReferredByAgentName)
            ? dto.ReferredByAgentName.Trim()
            : currentUserName;

        // 2. Resolve or Link Investor & Lead
        int? investorId = null;
        int parsedId = 0;
        if (!string.IsNullOrWhiteSpace(dto.InvestorId))
        {
            var digitsMatch = System.Text.RegularExpressions.Regex.Match(dto.InvestorId, @"\d+");
            if (digitsMatch.Success)
            {
                int.TryParse(digitsMatch.Value, out parsedId);
            }
        }

        // Check if an investor already exists with this ID
        if (parsedId > 0)
        {
            var investorExists = await _context.Investors.AnyAsync(i => i.Id == parsedId && i.CompanyId == companyId, ct);
            if (investorExists)
            {
                investorId = parsedId;
            }
        }

        // Check if an investor exists with matching phone
        if (!investorId.HasValue && !string.IsNullOrWhiteSpace(dto.InvestorPhone))
        {
            var cleanPhone = dto.InvestorPhone.Trim();
            var last10 = cleanPhone.Length >= 10 ? cleanPhone.Substring(cleanPhone.Length - 10) : cleanPhone;
            var investorByPhone = await _context.Investors
                .FirstOrDefaultAsync(i => i.CompanyId == companyId && (i.Phone == cleanPhone || i.Phone.EndsWith(last10)), ct);
            if (investorByPhone != null)
            {
                investorId = investorByPhone.Id;
            }
        }

        // Look up corresponding lead (by parsedId or phone)
        Lead? matchedLead = null;
        if (parsedId > 0)
        {
            matchedLead = await _context.Leads.FirstOrDefaultAsync(l => l.Id == parsedId && l.CompanyId == companyId, ct);
        }
        if (matchedLead == null && !string.IsNullOrWhiteSpace(dto.InvestorPhone))
        {
            var cleanPhone = dto.InvestorPhone.Trim();
            var last10 = cleanPhone.Length >= 10 ? cleanPhone.Substring(cleanPhone.Length - 10) : cleanPhone;
            matchedLead = await _context.Leads
                .FirstOrDefaultAsync(l => l.CompanyId == companyId && (l.Phone == cleanPhone || l.Phone.EndsWith(last10)), ct);
        }

        // If no Investor exists yet, create one for this lead/prospect so IRM has it and Foreign Key is guaranteed valid!
        if (!investorId.HasValue)
        {
            try
            {
                var newInvestor = new Investor
                {
                    CompanyId = companyId,
                    Name = dto.InvestorName.Trim(),
                    Phone = dto.InvestorPhone.Trim(),
                    Email = matchedLead?.Email ?? string.Empty,
                    Status = InvestorStatus.Lead,
                    AssignedIrmId = consultantId,
                    AssignedIrmName = consultantName,
                    InvestmentCapacity = matchedLead?.InvestmentCapacity ?? string.Empty,
                    PreferredAssetClass = matchedLead?.PreferredAssetClass ?? "AIF",
                    Notes = $"Connected from Lead {(matchedLead != null ? $"#{matchedLead.Id}" : "")} via call by {referredBy}",
                    CreatedAt = DateTime.UtcNow
                };
                _context.Investors.Add(newInvestor);
                await _context.SaveChangesAsync(ct);
                investorId = newInvestor.Id;
            }
            catch
            {
                // Fallback: If investor creation encounters an issue, investorId remains null (allowed by Consultation schema)
                investorId = null;
            }
        }

        // If a lead was matched, update the lead's status and assigned IRM
        if (matchedLead != null)
        {
            matchedLead.Status = "Interested";
            var customFields = new Dictionary<string, object>();
            if (!string.IsNullOrEmpty(matchedLead.CustomFieldsJson))
            {
                try
                {
                    customFields = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(matchedLead.CustomFieldsJson) ?? new();
                }
                catch { }
            }
            customFields["transferredToIrm"] = "true";
            customFields["assignedIrmId"] = consultantId.ToString();
            customFields["assignedIrmName"] = consultantName;
            customFields["assignedIrmAt"] = DateTime.UtcNow.ToString("o");
            matchedLead.CustomFieldsJson = System.Text.Json.JsonSerializer.Serialize(customFields);
            matchedLead.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync(ct);
        }

        // 3. Create Consultation
        var consultation = new Consultation
        {
            CompanyId = companyId,
            ConsultantId = consultantId,
            ConsultantName = consultantName,
            InvestorId = investorId,
            InvestorName = dto.InvestorName.Trim(),
            InvestorPhone = dto.InvestorPhone.Trim(),
            ScheduledAt = dto.ScheduledAt != default 
                ? (dto.ScheduledAt.Kind == DateTimeKind.Utc ? dto.ScheduledAt : DateTime.SpecifyKind(dto.ScheduledAt, DateTimeKind.Utc)) 
                : DateTime.UtcNow,
            Status = ConsultationStatus.Scheduled,
            Agenda = dto.Agenda?.Trim() ?? string.Empty,
            OutcomeNotes = dto.Notes?.Trim() ?? string.Empty,
            ReferredByAgentName = referredBy,
            CreatedAt = DateTime.UtcNow
        };

        _context.Consultations.Add(consultation);
        await _context.SaveChangesAsync(ct);

        await _context.Entry(consultation).Reference(c => c.Consultant).LoadAsync(ct);

        return ApiResponse<ConsultationResponseDto>.SuccessResult(MapToSalesExecDto(consultation), "Consultation scheduled successfully.");
    }

    public async Task<ApiResponse<ConsultationResponseDto>> UpdateConsultationAsync(
        int id, backend.DTOs.Consultations.UpdateConsultationDto dto, CancellationToken ct = default)
    {
        var consultation = await FindScopedConsultationAsync(id, ct);
        if (consultation == null)
            return ApiResponse<ConsultationResponseDto>.FailureResult("Consultation not found or access denied.");

        if (dto.ScheduledAt.HasValue)
        {
            var dt = dto.ScheduledAt.Value;
            consultation.ScheduledAt = dt.Kind == DateTimeKind.Utc ? dt : DateTime.SpecifyKind(dt, DateTimeKind.Utc);
        }
        if (!string.IsNullOrWhiteSpace(dto.Status) && Enum.TryParse<ConsultationStatus>(dto.Status, true, out var st))
        {
            consultation.Status = st;
        }
        if (dto.Agenda != null) consultation.Agenda = dto.Agenda.Trim();
        if (dto.OutcomeNotes != null) consultation.OutcomeNotes = dto.OutcomeNotes.Trim();

        consultation.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(ct);

        return ApiResponse<ConsultationResponseDto>.SuccessResult(MapToSalesExecDto(consultation), "Consultation updated successfully.");
    }

    // ── IRM Repository-Backed Methods ────────────────────────────────────────

    public async Task<ApiResponse<List<ConsultationDto>>> GetAllAsync(
        int companyId, int? consultantId, string? status, DateTime? from, DateTime? to, CancellationToken ct = default)
    {
        var list = await _consultationRepo.GetAllAsync(companyId, consultantId, status, from, to, ct);
        return ApiResponse<List<ConsultationDto>>.SuccessResponse(list.Select(MapToIrmDto).ToList());
    }

    public async Task<ApiResponse<ConsultationDto>> GetByIdAsync(int id, int companyId, CancellationToken ct = default)
    {
        var c = await _consultationRepo.GetByIdAsync(id, companyId, ct);
        if (c == null)
            return ApiResponse<ConsultationDto>.ErrorResponse("Consultation not found");

        return ApiResponse<ConsultationDto>.SuccessResponse(MapToIrmDto(c));
    }

    public async Task<ApiResponse<ConsultationDto>> CreateAsync(
        int companyId, int consultantId, CreateConsultationDto dto, CancellationToken ct = default)
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
        return ApiResponse<ConsultationDto>.SuccessResponse(MapToIrmDto(created), "Consultation scheduled successfully");
    }

    public async Task<ApiResponse<ConsultationDto>> UpdateAsync(
        int id, int companyId, backend.DTOs.Irm.UpdateConsultationDto dto, CancellationToken ct = default)
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
        return ApiResponse<ConsultationDto>.SuccessResponse(MapToIrmDto(updated), "Consultation updated successfully");
    }

    public async Task<ApiResponse<ConsultationDto>> RecordOutcomeAsync(
        int id, int companyId, ConsultationOutcomeDto dto, CancellationToken ct = default)
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
        return ApiResponse<ConsultationDto>.SuccessResponse(MapToIrmDto(updated), "Consultation outcome recorded");
    }

    public async Task<ApiResponse<bool>> DeleteAsync(int id, int companyId, CancellationToken ct = default)
    {
        var c = await _consultationRepo.GetByIdAsync(id, companyId, ct);
        if (c == null)
            return ApiResponse<bool>.ErrorResponse("Consultation not found");

        await _consultationRepo.DeleteAsync(id, ct);
        return ApiResponse<bool>.SuccessResponse(true, "Consultation cancelled successfully");
    }

    public async Task<ApiResponse<List<IrmUserDto>>> GetCompanyIrmsAsync(CancellationToken ct = default)
    {
        var companyId = _currentUser.CompanyId ?? 1;

        var query = _context.Users
            .AsNoTracking()
            .Include(u => u.Role)
            .Where(u => u.Role != null && (u.Role.Code == "irm" || u.Role.Name.ToLower().Contains("irm") || u.Role.Name.ToLower().Contains("investor relationship")))
            .Where(u => u.Status == UserStatus.Active);

        var companyIrms = await query
            .Where(u => u.CompanyId == companyId)
            .Select(u => new IrmUserDto
            {
                Id = u.Id,
                Name = u.Name,
                Email = u.Email,
                Phone = u.Phone,
                Status = "Available",
                Specialization = "Wealth & Private Advisory"
            })
            .ToListAsync(ct);

        if (companyIrms.Count == 0)
        {
            companyIrms = await query
                .Select(u => new IrmUserDto
                {
                    Id = u.Id,
                    Name = u.Name,
                    Email = u.Email,
                    Phone = u.Phone,
                    Status = "Available",
                    Specialization = "Wealth & Private Advisory"
                })
                .ToListAsync(ct);
        }

        return ApiResponse<List<IrmUserDto>>.SuccessResult(companyIrms, "Active IRMs retrieved successfully.");
    }

    // ── Mapping Helpers ──────────────────────────────────────────────────────

    private static ConsultationResponseDto MapToSalesExecDto(Consultation c)
    {
        return new ConsultationResponseDto
        {
            Id = c.Id,
            CompanyId = c.CompanyId,
            ConsultantId = c.ConsultantId,
            ConsultantName = c.Consultant?.Name ?? c.ConsultantName,
            InvestorId = c.InvestorId?.ToString() ?? string.Empty,
            InvestorName = c.InvestorName,
            InvestorPhone = c.InvestorPhone,
            ScheduledAt = c.ScheduledAt,
            Status = c.Status.ToString(),
            Agenda = c.Agenda,
            OutcomeNotes = c.OutcomeNotes ?? string.Empty,
            ReferredByAgentName = c.ReferredByAgentName,
            CreatedAt = c.CreatedAt,
            UpdatedAt = c.UpdatedAt
        };
    }

    private static ConsultationDto MapToIrmDto(Consultation c) => new()
    {
        Id = c.Id,
        InvestorId = c.InvestorId ?? 0,
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
