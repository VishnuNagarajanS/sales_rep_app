namespace backend.DTOs.WorkHandover;

public class WorkHandoverCandidateDto
{
    public int UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string RoleCode { get; set; } = string.Empty;
    public string RoleName { get; set; } = string.Empty;
    public int OpenItemsCount { get; set; }
    public bool IsCovered { get; set; }
    public bool IsCovering { get; set; }
    public int? ActiveHandoverId { get; set; }
}

public class WorkHandoverCountsDto
{
    public int LeadsCount { get; set; }
    public int CustomersCount { get; set; }
    public int FollowupsCount { get; set; }
    public int DealsCount { get; set; }
    public int InvestorsCount { get; set; }
    public int KycsCount { get; set; }
    public int OpportunitiesCount { get; set; }
    public int ConsultationsCount { get; set; }
    public int PipelineCardsCount { get; set; }
    public int TotalCount => LeadsCount + CustomersCount + FollowupsCount + DealsCount + InvestorsCount + KycsCount + OpportunitiesCount + ConsultationsCount + PipelineCardsCount;
}

public class WorkHandoverPreviewDto : WorkHandoverCountsDto
{
    public int FromUserId { get; set; }
    public string FromUserName { get; set; } = string.Empty;
    public int ToUserId { get; set; }
    public string ToUserName { get; set; } = string.Empty;
    public string RoleCode { get; set; } = string.Empty;
}

public class StartWorkHandoverRequestDto
{
    public int FromUserId { get; set; }
    public int ToUserId { get; set; }
    public string Reason { get; set; } = string.Empty;
    public DateTime? PlannedEndAt { get; set; }
}

public class ReturnSelectedItemsRequestDto
{
    public List<int> ItemIds { get; set; } = new();
}

public class WorkHandoverProgressDto
{
    public int CallsMadeCount { get; set; }
    public int FollowupsCompletedCount { get; set; }
    public int StatusChangesCount { get; set; }
    public int NewRecordsCreatedCount { get; set; }
    public int RecordsConvertedOrClosedCount { get; set; }
    public int RecordsSkippedCount { get; set; }
    public List<string> Highlights { get; set; } = new();
}

public class WorkHandoverItemDto
{
    public int Id { get; set; }
    public int HandoverId { get; set; }
    public string EntityType { get; set; } = string.Empty;
    public int EntityId { get; set; }
    public string EntityTitle { get; set; } = string.Empty;
    public string Origin { get; set; } = "included_at_start";
    public DateTime? ReturnedAt { get; set; }
    public string? ReturnOutcome { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class WorkHandoverDto
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string RoleCode { get; set; } = string.Empty;
    public int OriginalUserId { get; set; }
    public string OriginalUserName { get; set; } = string.Empty;
    public string OriginalUserEmail { get; set; } = string.Empty;
    public int CoveringUserId { get; set; }
    public string CoveringUserName { get; set; } = string.Empty;
    public string CoveringUserEmail { get; set; } = string.Empty;
    public int StartedById { get; set; }
    public string StartedByName { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public DateTime StartedAt { get; set; }
    public DateTime? PlannedEndAt { get; set; }
    public string Status { get; set; } = "active";
    public DateTime? EndedAt { get; set; }
    public int? EndedById { get; set; }
    public string? EndedByName { get; set; }
    public WorkHandoverProgressDto? Progress { get; set; }
    public int TotalItemsCount { get; set; }
    public int ActiveItemsCount { get; set; }
    public List<WorkHandoverItemDto> Items { get; set; } = new();
}
