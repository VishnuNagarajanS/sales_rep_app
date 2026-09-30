using backend.DTOs.Common;
using backend.Helpers;
using backend.DTOs.Irm;
using backend.Models.Entities;
using backend.Models.Enums;
using backend.Repositories.Interfaces;
using backend.Services.Interfaces;

namespace backend.Services.Implementations;

public class InvestorService : IInvestorService
{
    private readonly IInvestorRepository _investorRepo;
    private readonly IUserRepository _userRepo;

    public InvestorService(IInvestorRepository investorRepo, IUserRepository userRepo)
    {
        _investorRepo = investorRepo;
        _userRepo = userRepo;
    }

    public async Task<ApiResponse<List<InvestorDto>>> GetAllAsync(int companyId, string? status, string? assetClass, int? irmId, CancellationToken ct = default)
    {
        var investors = await _investorRepo.GetAllAsync(companyId, status, assetClass, irmId, ct);
        var dtos = investors.Select(MapToDto).ToList();
        return ApiResponse<List<InvestorDto>>.SuccessResponse(dtos);
    }

    public async Task<ApiResponse<InvestorActivityListDto>> GetByIdAsync(int id, int companyId, CancellationToken ct = default)
    {
        var investor = await _investorRepo.GetByIdAsync(id, companyId, ct);
        if (investor == null)
            return ApiResponse<InvestorActivityListDto>.ErrorResponse("Investor not found");

        var activities = new List<InvestorActivityDto>();

        foreach (var call in investor.Calls.OrderByDescending(c => c.CalledAt))
        {
            activities.Add(new InvestorActivityDto
            {
                Type = "call",
                Description = $"Call with {investor.Name} — Outcome: {call.Outcome}. {call.Notes}",
                PerformedBy = call.IrmName,
                Timestamp = call.CalledAt,
                Meta = $"Duration: {call.DurationSeconds}s"
            });
        }

        foreach (var cons in investor.Consultations.OrderByDescending(c => c.ScheduledAt))
        {
            activities.Add(new InvestorActivityDto
            {
                Type = "consultation",
                Description = $"Consultation ({cons.Status}): {cons.Agenda}. {cons.OutcomeNotes}",
                PerformedBy = cons.ConsultantName,
                Timestamp = cons.ScheduledAt
            });
        }

        foreach (var f in investor.Followups.OrderByDescending(f => f.ScheduledAt))
        {
            activities.Add(new InvestorActivityDto
            {
                Type = "followup",
                Description = $"Followup scheduled: {f.Agenda}. Status: {f.Status}",
                PerformedBy = f.AssignedToName,
                Timestamp = f.ScheduledAt
            });
        }

        var result = new InvestorActivityListDto
        {
            Investor = MapToDto(investor),
            Activities = activities.OrderByDescending(a => a.Timestamp).ToList()
        };

        return ApiResponse<InvestorActivityListDto>.SuccessResponse(result);
    }

    public async Task<ApiResponse<InvestorDto>> CreateAsync(int companyId, int irmId, CreateInvestorDto dto, CancellationToken ct = default)
    {
        var irmUser = await _userRepo.GetByIdAsync(irmId, ct);

        // ── Duplicate check: phone (last 10 digits, normalized) and email (case-insensitive, trimmed) ──
        var normalizedPhone = NormalizePhone(dto.Phone);
        var normalizedEmail = (dto.Email ?? string.Empty).Trim().ToLowerInvariant();

        var allInvestors = await _investorRepo.GetAllAsync(companyId, null, null, null, ct);

        foreach (var existing in allInvestors)
        {
            var existingPhone = NormalizePhone(existing.Phone);
            var existingEmail = (existing.Email ?? string.Empty).Trim().ToLowerInvariant();

            bool phoneMatch = !string.IsNullOrWhiteSpace(normalizedPhone) && normalizedPhone == existingPhone;
            bool emailMatch = !string.IsNullOrWhiteSpace(normalizedEmail) && normalizedEmail == existingEmail;

            if (phoneMatch || emailMatch)
            {
                var dupField = phoneMatch ? $"phone {existing.Phone}" : $"email {existing.Email}";
                return ApiResponse<InvestorDto>.ErrorResponse(
                    $"A record with this {dupField} already exists: \"{existing.Name}\" (ID: {existing.Id}). Please update the existing record instead of creating a duplicate.");
            }
        }

        var investor = new Investor
        {
            CompanyId = companyId,
            Name = dto.Name.Trim(),
            Phone = dto.Phone?.Trim() ?? string.Empty,
            Email = dto.Email?.Trim() ?? string.Empty,
            Status = InvestorStatus.Lead,
            InvestmentCapacity = dto.InvestmentCapacity,
            PreferredAssetClass = dto.PreferredAssetClass,
            RiskTolerance = dto.RiskTolerance,
            InvestmentMandate = dto.InvestmentMandate,
            ReferralSource = dto.ReferralSource,
            AssignedIrmId = irmId,
            AssignedIrmName = irmUser?.Name ?? string.Empty,
            Notes = dto.Notes,
            CreatedAt = DateTime.UtcNow
        };

        var created = await _investorRepo.CreateAsync(investor, ct);
        return ApiResponse<InvestorDto>.SuccessResponse(MapToDto(created), "Investor created successfully");
    }

    /// <summary>
    /// Normalizes a phone number to its last 10 digits for comparison.
    /// Strips all non-digit characters and returns the trailing 10 digits.
    /// </summary>
    private static string NormalizePhone(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone)) return string.Empty;
        var digits = new string(phone.Where(char.IsDigit).ToArray());
        return digits.Length >= 10 ? digits[^10..] : digits;
    }

    public async Task<ApiResponse<InvestorDto>> UpdateAsync(int id, int companyId, UpdateInvestorDto dto, CancellationToken ct = default)
    {
        var investor = await _investorRepo.GetByIdAsync(id, companyId, ct);
        if (investor == null)
            return ApiResponse<InvestorDto>.ErrorResponse("Investor not found");

        if (!string.IsNullOrWhiteSpace(dto.Name)) investor.Name = dto.Name;
        if (!string.IsNullOrWhiteSpace(dto.Phone)) investor.Phone = dto.Phone;
        if (!string.IsNullOrWhiteSpace(dto.Email)) investor.Email = dto.Email;
        if (dto.InvestmentCapacity != null) investor.InvestmentCapacity = OptionalFieldNormalizer.Normalize(dto.InvestmentCapacity) ?? string.Empty;
        if (dto.PreferredAssetClass != null) investor.PreferredAssetClass = OptionalFieldNormalizer.Normalize(dto.PreferredAssetClass) ?? string.Empty;
        if (dto.RiskTolerance != null) investor.RiskTolerance = dto.RiskTolerance;
        if (dto.InvestmentMandate != null) investor.InvestmentMandate = dto.InvestmentMandate;
        if (dto.CommittedAum != null) investor.CommittedAum = dto.CommittedAum;
        if (dto.ReferralSource != null) investor.ReferralSource = dto.ReferralSource;
        if (dto.Notes != null) investor.Notes = dto.Notes;

        if (!string.IsNullOrWhiteSpace(dto.Status) && Enum.TryParse<InvestorStatus>(dto.Status, true, out var parsedStatus))
        {
            investor.Status = parsedStatus;
        }

        var updated = await _investorRepo.UpdateAsync(investor, ct);
        return ApiResponse<InvestorDto>.SuccessResponse(MapToDto(updated), "Investor updated successfully");
    }

    public async Task<ApiResponse<bool>> DeleteAsync(int id, int companyId, CancellationToken ct = default)
    {
        var exists = await _investorRepo.ExistsAsync(id, companyId, ct);
        if (!exists)
            return ApiResponse<bool>.ErrorResponse("Investor not found");

        await _investorRepo.DeleteAsync(id, ct);
        return ApiResponse<bool>.SuccessResponse(true, "Investor deleted successfully");
    }

    private static InvestorDto MapToDto(Investor i) => new()
    {
        Id = i.Id,
        CompanyId = i.CompanyId,
        Name = i.Name,
        Phone = i.Phone,
        Email = i.Email,
        Status = i.Status.ToString(),
        InvestmentCapacity = i.InvestmentCapacity,
        PreferredAssetClass = i.PreferredAssetClass,
        RiskTolerance = i.RiskTolerance,
        InvestmentMandate = i.InvestmentMandate,
        CommittedAum = i.CommittedAum,
        ReferralSource = i.ReferralSource,
        AssignedIrmId = i.AssignedIrmId,
        AssignedIrmName = i.AssignedIrmName,
        Notes = i.Notes,
        CreatedAt = i.CreatedAt,
        UpdatedAt = i.UpdatedAt
    };
}
