using backend.DTOs.Common;
using backend.DTOs.Irm;
using backend.Models.Entities;
using backend.Repositories.Interfaces;
using backend.Services.Interfaces;

namespace backend.Services.Implementations;

public class OpportunityService : IOpportunityService
{
    private readonly IOpportunityRepository _oppRepo;
    private readonly IInvestorRepository _investorRepo;
    private readonly IUserRepository _userRepo;

    public OpportunityService(IOpportunityRepository oppRepo, IInvestorRepository investorRepo, IUserRepository userRepo)
    {
        _oppRepo = oppRepo;
        _investorRepo = investorRepo;
        _userRepo = userRepo;
    }

    public async Task<ApiResponse<List<OpportunityDto>>> GetAllAsync(int companyId, bool? isActive, CancellationToken ct = default)
    {
        var list = await _oppRepo.GetAllAsync(companyId, isActive, ct);
        return ApiResponse<List<OpportunityDto>>.SuccessResponse(list.Select(MapToDto).ToList());
    }

    public async Task<ApiResponse<OpportunityDto>> GetByIdAsync(int id, int companyId, CancellationToken ct = default)
    {
        var opp = await _oppRepo.GetByIdAsync(id, companyId, ct);
        if (opp == null)
            return ApiResponse<OpportunityDto>.ErrorResponse("Opportunity not found");

        return ApiResponse<OpportunityDto>.SuccessResponse(MapToDto(opp));
    }

    public async Task<ApiResponse<OpportunityDto>> CreateAsync(int companyId, int irmId, CreateOpportunityDto dto, CancellationToken ct = default)
    {
        var opp = new InvestmentOpportunity
        {
            CompanyId = companyId,
            CreatedByIrmId = irmId,
            Title = dto.Title,
            AssetClass = dto.AssetClass,
            Description = dto.Description,
            TargetIrr = dto.TargetIrr,
            MinTicketSize = dto.MinTicketSize,
            Tenure = dto.Tenure,
            RiskLevel = dto.RiskLevel,
            TotalTargetCorpus = dto.TotalTargetCorpus,
            CommittedAmount = 0,
            IsActive = true,
            ClosingDate = dto.ClosingDate,
            BrochureUrl = dto.BrochureUrl,
            CreatedAt = DateTime.UtcNow
        };

        var created = await _oppRepo.CreateAsync(opp, ct);
        return ApiResponse<OpportunityDto>.SuccessResponse(MapToDto(created), "Investment opportunity created successfully");
    }

    public async Task<ApiResponse<OpportunityPitchDto>> PitchAsync(int opportunityId, int companyId, int irmId, PitchOpportunityDto dto, CancellationToken ct = default)
    {
        var opp = await _oppRepo.GetByIdAsync(opportunityId, companyId, ct);
        if (opp == null)
            return ApiResponse<OpportunityPitchDto>.ErrorResponse("Opportunity not found");

        var investor = await _investorRepo.GetByIdAsync(dto.InvestorId, companyId, ct);
        if (investor == null)
            return ApiResponse<OpportunityPitchDto>.ErrorResponse("Investor not found");

        var user = await _userRepo.GetByIdAsync(irmId, ct);

        var existingPitch = await _oppRepo.GetPitchAsync(opportunityId, dto.InvestorId, ct);
        if (existingPitch != null)
        {
            existingPitch.PitchNotes = dto.PitchNotes;
            existingPitch.PitchedAt = DateTime.UtcNow;
            await _oppRepo.UpdatePitchAsync(existingPitch, ct);
            return ApiResponse<OpportunityPitchDto>.SuccessResponse(MapPitchToDto(existingPitch, investor.Name, user?.Name ?? string.Empty), "Pitch updated");
        }

        var pitch = new OpportunityPitch
        {
            OpportunityId = opportunityId,
            InvestorId = dto.InvestorId,
            PitchedByIrmId = irmId,
            PitchedAt = DateTime.UtcNow,
            PitchNotes = dto.PitchNotes,
            IsCommitted = false
        };

        var created = await _oppRepo.AddPitchAsync(pitch, ct);
        return ApiResponse<OpportunityPitchDto>.SuccessResponse(MapPitchToDto(created, investor.Name, user?.Name ?? string.Empty), "Opportunity pitched to investor");
    }

    public async Task<ApiResponse<OpportunityPitchDto>> CommitAsync(int opportunityId, int companyId, CommitOpportunityDto dto, CancellationToken ct = default)
    {
        var opp = await _oppRepo.GetByIdAsync(opportunityId, companyId, ct);
        if (opp == null)
            return ApiResponse<OpportunityPitchDto>.ErrorResponse("Opportunity not found");

        var investor = await _investorRepo.GetByIdAsync(dto.InvestorId, companyId, ct);
        if (investor == null)
            return ApiResponse<OpportunityPitchDto>.ErrorResponse("Investor not found");

        var pitch = await _oppRepo.GetPitchAsync(opportunityId, dto.InvestorId, ct);
        if (pitch == null)
        {
            pitch = new OpportunityPitch
            {
                OpportunityId = opportunityId,
                InvestorId = dto.InvestorId,
                PitchedByIrmId = opp.CreatedByIrmId,
                PitchedAt = DateTime.UtcNow,
                IsCommitted = true,
                CommittedAmount = dto.CommittedAmount,
                CommittedAt = DateTime.UtcNow,
                CommitmentNotes = dto.CommitmentNotes
            };
            await _oppRepo.AddPitchAsync(pitch, ct);
        }
        else
        {
            pitch.IsCommitted = true;
            pitch.CommittedAmount = dto.CommittedAmount;
            pitch.CommittedAt = DateTime.UtcNow;
            pitch.CommitmentNotes = dto.CommitmentNotes;
            await _oppRepo.UpdatePitchAsync(pitch, ct);
        }

        // Update opportunity total committed amount
        opp.CommittedAmount += dto.CommittedAmount;
        await _oppRepo.UpdateAsync(opp, ct);

        // Update investor committed AUM
        var currentAum = decimal.TryParse(investor.CommittedAum, out var parsed) ? parsed : 0;
        investor.CommittedAum = $"₹{(currentAum + dto.CommittedAmount) / 10000000:0.##} Cr";
        await _investorRepo.UpdateAsync(investor, ct);

        return ApiResponse<OpportunityPitchDto>.SuccessResponse(MapPitchToDto(pitch, investor.Name, string.Empty), "Commitment recorded successfully");
    }

    public async Task<ApiResponse<List<OpportunityPitchDto>>> GetPitchesAsync(int opportunityId, int companyId, CancellationToken ct = default)
    {
        var opp = await _oppRepo.GetByIdAsync(opportunityId, companyId, ct);
        if (opp == null)
            return ApiResponse<List<OpportunityPitchDto>>.ErrorResponse("Opportunity not found");

        var pitches = await _oppRepo.GetPitchesByOpportunityAsync(opportunityId, ct);
        var dtos = pitches.Select(p => MapPitchToDto(p, p.Investor?.Name ?? string.Empty, p.PitchedByIrm?.Name ?? string.Empty)).ToList();
        return ApiResponse<List<OpportunityPitchDto>>.SuccessResponse(dtos);
    }

    private static OpportunityDto MapToDto(InvestmentOpportunity o) => new()
    {
        Id = o.Id,
        CompanyId = o.CompanyId,
        CreatedByIrmId = o.CreatedByIrmId,
        Title = o.Title,
        AssetClass = o.AssetClass,
        Description = o.Description,
        TargetIrr = o.TargetIrr,
        MinTicketSize = o.MinTicketSize,
        Tenure = o.Tenure,
        RiskLevel = o.RiskLevel,
        TotalTargetCorpus = o.TotalTargetCorpus,
        CommittedAmount = o.CommittedAmount,
        IsActive = o.IsActive,
        ClosingDate = o.ClosingDate,
        BrochureUrl = o.BrochureUrl,
        FactsheetUrl = o.FactsheetUrl,
        CreatedAt = o.CreatedAt,
        UpdatedAt = o.UpdatedAt
    };

    private static OpportunityPitchDto MapPitchToDto(OpportunityPitch p, string investorName, string irmName) => new()
    {
        Id = p.Id,
        OpportunityId = p.OpportunityId,
        InvestorId = p.InvestorId,
        InvestorName = investorName,
        PitchedByIrmId = p.PitchedByIrmId,
        PitchedByIrmName = irmName,
        PitchedAt = p.PitchedAt,
        PitchNotes = p.PitchNotes,
        IsCommitted = p.IsCommitted,
        CommittedAmount = p.CommittedAmount,
        CommittedAt = p.CommittedAt,
        CommitmentNotes = p.CommitmentNotes
    };
}
