using System.Text.Json;
using backend.DTOs.Common;
using backend.DTOs.Irm;
using backend.Models.Entities;
using backend.Repositories.Interfaces;
using backend.Services.Interfaces;

namespace backend.Services.Implementations;

public class IrmPipelineService : IIrmPipelineService
{
    private readonly IIrmPipelineRepository _pipelineRepo;
    private readonly IInvestorRepository _investorRepo;
    private readonly IUserRepository _userRepo;
    private readonly IIrmOtherService? _otherService;

    public IrmPipelineService(IIrmPipelineRepository pipelineRepo, IInvestorRepository investorRepo, IUserRepository userRepo, IIrmOtherService? otherService = null)
    {
        _pipelineRepo = pipelineRepo;
        _investorRepo = investorRepo;
        _userRepo = userRepo;
        _otherService = otherService;
    }

    public async Task<ApiResponse<IrmPipelineBoardDto>> GetBoardAsync(int companyId, int? irmId, CancellationToken ct = default)
    {
        var cards = await _pipelineRepo.GetAllAsync(companyId, irmId, ct);
        if (_otherService != null)
        {
            var matcher = await _otherService.GetOtherMatcherAsync(companyId, null, ct);
            if (matcher.HasAnyOther)
            {
                cards = cards.Where(c => !matcher.IsInOther(c.InvestorPhone, c.InvestorId, null, c.InvestorName)).ToList();
            }
        }
        var cardDtos = cards.Select(MapToCardDto).ToList();

        var stages = new List<IrmPipelineStageDto>
        {
            new() { Id = "leads", Name = "Leads", Color = "#64748b", Cards = cardDtos.Where(c => c.StageId == "leads").ToList() },
            new() { Id = "followup", Name = "Follow Up", Color = "#3b82f6", Cards = cardDtos.Where(c => c.StageId == "followup").ToList() },
            new() { Id = "qualified_investor", Name = "Qualified Investor", Color = "#8b5cf6", Cards = cardDtos.Where(c => c.StageId == "qualified_investor").ToList() },
            new() { Id = "investment_opportunity", Name = "Investment Opportunity", Color = "#f59e0b", Cards = cardDtos.Where(c => c.StageId == "investment_opportunity").ToList() },
            new() { Id = "converted", Name = "Converted", Color = "#10b981", Cards = cardDtos.Where(c => c.StageId == "converted").ToList() }
        };

        return ApiResponse<IrmPipelineBoardDto>.SuccessResponse(new IrmPipelineBoardDto { Stages = stages });
    }

    public async Task<ApiResponse<IrmPipelineCardDto>> MoveStageAsync(int cardId, int companyId, int irmId, MoveIrmStageDto dto, CancellationToken ct = default)
    {
        var card = await _pipelineRepo.GetByIdAsync(cardId, companyId, ct);
        if (card == null)
            return ApiResponse<IrmPipelineCardDto>.ErrorResponse("Pipeline card not found");

        var oldStage = card.StageId;
        card.StageId = dto.TargetStageId;
        card.StageEnteredAt = DateTime.UtcNow;
        card.LastActionSnippet = $"Moved from {oldStage} to {dto.TargetStageId}";
        card.LastActivityDate = DateTime.UtcNow;

        // Append to activity log
        var logs = new List<object>();
        if (!string.IsNullOrEmpty(card.ActivityLogsJson))
        {
            try { logs = JsonSerializer.Deserialize<List<object>>(card.ActivityLogsJson) ?? new(); }
            catch { logs = new(); }
        }

        logs.Add(new
        {
            type = "stage_change",
            details = $"Moved to stage {dto.TargetStageId}",
            timestamp = DateTime.UtcNow
        });
        card.ActivityLogsJson = JsonSerializer.Serialize(logs);

        var updated = await _pipelineRepo.UpdateAsync(card, ct);
        return ApiResponse<IrmPipelineCardDto>.SuccessResponse(MapToCardDto(updated), $"Moved to {dto.TargetStageId}");
    }

    public async Task<ApiResponse<IrmPipelineCardDto>> LogActivityAsync(int cardId, int companyId, int irmId, LogIrmActivityDto dto, CancellationToken ct = default)
    {
        var card = await _pipelineRepo.GetByIdAsync(cardId, companyId, ct);
        if (card == null)
            return ApiResponse<IrmPipelineCardDto>.ErrorResponse("Pipeline card not found");

        card.LastActionSnippet = dto.Details;
        card.LastActivityDate = DateTime.UtcNow;

        var logs = new List<object>();
        if (!string.IsNullOrEmpty(card.ActivityLogsJson))
        {
            try { logs = JsonSerializer.Deserialize<List<object>>(card.ActivityLogsJson) ?? new(); }
            catch { logs = new(); }
        }

        logs.Add(new
        {
            type = dto.Type,
            details = dto.Details,
            timestamp = DateTime.UtcNow
        });
        card.ActivityLogsJson = JsonSerializer.Serialize(logs);

        var updated = await _pipelineRepo.UpdateAsync(card, ct);
        return ApiResponse<IrmPipelineCardDto>.SuccessResponse(MapToCardDto(updated), "Activity logged successfully");
    }

    private static IrmPipelineCardDto MapToCardDto(IrmPipelineCard c) => new()
    {
        Id = c.Id,
        CompanyId = c.CompanyId,
        InvestorId = c.InvestorId,
        AssignedIrmId = c.AssignedIrmId,
        AssignedIrmName = c.AssignedIrmName,
        InvestorName = c.InvestorName,
        InvestorPhone = c.InvestorPhone,
        InvestorEmail = c.InvestorEmail,
        StageId = c.StageId,
        StageEnteredAt = c.StageEnteredAt,
        LastActionSnippet = c.LastActionSnippet,
        LastActivityDate = c.LastActivityDate,
        Priority = c.Priority,
        Value = c.Value,
        InvestmentAmount = c.InvestmentAmount,
        PreferredAssetClass = c.PreferredAssetClass,
        ActivityLogsJson = c.ActivityLogsJson,
        CreatedAt = c.CreatedAt
    };
}
