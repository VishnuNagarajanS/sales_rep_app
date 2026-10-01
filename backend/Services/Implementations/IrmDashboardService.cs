using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.Irm;
using backend.Models.Enums;
using backend.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Implementations;

public class IrmDashboardService : IIrmDashboardService
{
    private readonly ApplicationDbContext _db;

    public IrmDashboardService(ApplicationDbContext db) => _db = db;

    public async Task<ApiResponse<IrmDashboardMetricsDto>> GetMetricsAsync(int companyId, int? irmId, CancellationToken ct = default)
    {
        var today = DateTime.UtcNow.Date;
        var tomorrow = today.AddDays(1);

        var investorQuery = _db.Investors.Where(i => i.CompanyId == companyId);
        if (irmId.HasValue) investorQuery = investorQuery.Where(i => i.AssignedIrmId == irmId);

        var totalInvestors = await investorQuery.CountAsync(ct);
        var activeInvestors = await investorQuery.CountAsync(i => i.Status == InvestorStatus.ActiveInvestor || i.Status == InvestorStatus.HnwInvestor, ct);

        var kycQuery = _db.InvestorKycs.Where(k => k.CompanyId == companyId);
        if (irmId.HasValue) kycQuery = kycQuery.Where(k => k.IrmId == irmId);
        var pendingKyc = await kycQuery.CountAsync(k => k.Status == KycStatus.PendingReview, ct);

        var consQuery = _db.Consultations.Where(c => c.CompanyId == companyId && c.ScheduledAt >= today && c.ScheduledAt < tomorrow);
        if (irmId.HasValue) consQuery = consQuery.Where(c => c.ConsultantId == irmId);
        var consultationsToday = await consQuery.CountAsync(ct);

        var followupQuery = _db.Followups.Where(f => f.CompanyId == companyId && f.Status == FollowupStatus.Pending);
        if (irmId.HasValue) followupQuery = followupQuery.Where(f => f.AssignedAgentId == irmId);
        var pendingFollowups = await followupQuery.CountAsync(ct);

        var opportunitiesOpen = await _db.InvestmentOpportunities.CountAsync(o => o.CompanyId == companyId && o.IsActive, ct);

        // Sum committed amount from opportunity pitches
        var totalCommittedAum = await _db.OpportunityPitches
            .Where(p => p.IsCommitted && p.CommittedAmount.HasValue)
            .SumAsync(p => p.CommittedAmount!.Value, ct);

        var metrics = new IrmDashboardMetricsDto
        {
            TotalCommittedAum = totalCommittedAum,
            ActiveInvestors = activeInvestors,
            PendingKycReviews = pendingKyc,
            ConsultationsToday = consultationsToday,
            PendingFollowups = pendingFollowups,
            TotalInvestors = totalInvestors,
            OpportunitiesOpen = opportunitiesOpen
        };

        return ApiResponse<IrmDashboardMetricsDto>.SuccessResponse(metrics);
    }
}
