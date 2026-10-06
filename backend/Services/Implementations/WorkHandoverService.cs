using System.Text.Json;
using backend.Data;
using backend.DTOs.WorkHandover;
using backend.Models.Entities;
using backend.Models.Enums;
using backend.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Implementations;

public class WorkHandoverService : IWorkHandoverService
{
    private readonly ApplicationDbContext _db;

    public WorkHandoverService(ApplicationDbContext db)
    {
        _db = db;
    }

    public async Task<List<WorkHandoverCandidateDto>> GetCandidatesAsync(int companyId, string roleCode, CancellationToken ct = default)
    {
        var normalizedRole = (roleCode ?? string.Empty).Trim().ToLowerInvariant();
        if (normalizedRole != "sales_executive" && normalizedRole != "irm")
            throw new ArgumentException("Role must be 'sales_executive' or 'irm'.");

        var users = await _db.Users
            .Include(u => u.Role)
            .Where(u => u.CompanyId == companyId && u.Role.Code.ToLower() == normalizedRole && u.Status == UserStatus.Active)
            .OrderBy(u => u.Name)
            .ToListAsync(ct);

        var activeHandovers = await _db.WorkHandovers
            .Where(h => h.CompanyId == companyId && h.Status == "active")
            .ToListAsync(ct);

        var coveredUserIds = activeHandovers.Select(h => h.OriginalUserId).ToHashSet();
        var coveringUserIds = activeHandovers.Select(h => h.CoveringUserId).ToHashSet();

        var result = new List<WorkHandoverCandidateDto>();

        foreach (var user in users)
        {
            var isCovered = coveredUserIds.Contains(user.Id);
            var isCovering = coveringUserIds.Contains(user.Id);
            var activeHandover = activeHandovers.FirstOrDefault(h => h.OriginalUserId == user.Id || h.CoveringUserId == user.Id);

            int openCount = 0;
            if (normalizedRole == "sales_executive")
            {
                var openLeads = await _db.Leads.CountAsync(l => l.CompanyId == companyId && l.AssignedAgentId == user.Id &&
                    l.Status != "Converted" && l.Status != "Not Interested" && l.Status != "Junk", ct);
                var openCustomers = await _db.Customers.CountAsync(c => c.CompanyId == companyId && c.AssignedAgentId == user.Id, ct);
                var openFollowups = await _db.Followups.CountAsync(f => f.CompanyId == companyId && f.AssignedAgentId == user.Id && f.Status == FollowupStatus.Pending, ct);
                var openDeals = await _db.GhlDeals.CountAsync(d => d.CompanyId == companyId && d.AssignedAgentId == user.Id &&
                    d.Stage != "won" && d.Stage != "lost" && d.Stage != "converted", ct);
                openCount = openLeads + openCustomers + openFollowups + openDeals;
            }
            else // irm
            {
                var openInvestors = await _db.Investors.CountAsync(i => i.CompanyId == companyId && i.AssignedIrmId == user.Id, ct);
                var openKycs = await _db.InvestorKycs.CountAsync(k => k.CompanyId == companyId && k.IrmId == user.Id &&
                    k.Status != KycStatus.Approved && k.Status != KycStatus.Rejected, ct);
                var openConsultations = await _db.Consultations.CountAsync(c => c.CompanyId == companyId && c.ConsultantId == user.Id &&
                    c.Status == ConsultationStatus.Scheduled, ct);
                var openCards = await _db.IrmPipelineCards.CountAsync(c => c.CompanyId == companyId && c.AssignedIrmId == user.Id, ct);
                var openFollowups = await _db.Followups.CountAsync(f => f.CompanyId == companyId && f.AssignedAgentId == user.Id && f.Status == FollowupStatus.Pending, ct);
                openCount = openInvestors + openKycs + openConsultations + openCards + openFollowups;
            }

            result.Add(new WorkHandoverCandidateDto
            {
                UserId = user.Id,
                Name = user.Name,
                Email = user.Email,
                RoleCode = user.Role.Code,
                RoleName = user.Role.Name,
                OpenItemsCount = openCount,
                IsCovered = isCovered,
                IsCovering = isCovering,
                ActiveHandoverId = activeHandover?.Id
            });
        }

        return result;
    }

    public async Task<WorkHandoverPreviewDto> GetPreviewAsync(int companyId, int fromUserId, int toUserId, CancellationToken ct = default)
    {
        if (fromUserId <= 0 || toUserId <= 0)
            throw new ArgumentException("Valid FromUserId and ToUserId are required.");

        if (fromUserId == toUserId)
            throw new InvalidOperationException("Source and covering user cannot be the same person.");

        var fromUser = await _db.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.Id == fromUserId && u.CompanyId == companyId, ct)
            ?? throw new KeyNotFoundException($"Source user ID {fromUserId} not found in this company.");

        var toUser = await _db.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.Id == toUserId && u.CompanyId == companyId, ct)
            ?? throw new KeyNotFoundException($"Target user ID {toUserId} not found in this company.");

        if (fromUser.Role.Code.ToLowerInvariant() != toUser.Role.Code.ToLowerInvariant())
            throw new InvalidOperationException($"Role mismatch: {fromUser.Name} is '{fromUser.Role.Code}' while {toUser.Name} is '{toUser.Role.Code}'. Handover is strictly allowed only between the same role.");

        if (toUser.Status != UserStatus.Active)
            throw new InvalidOperationException($"Target user '{toUser.Name}' is not Active and cannot receive handover.");

        var counts = await CalculateCountsAsync(companyId, fromUserId, ct);

        return new WorkHandoverPreviewDto
        {
            FromUserId = fromUser.Id,
            FromUserName = fromUser.Name,
            ToUserId = toUser.Id,
            ToUserName = toUser.Name,
            RoleCode = fromUser.Role.Code,
            LeadsCount = counts.LeadsCount,
            CustomersCount = counts.CustomersCount,
            FollowupsCount = counts.FollowupsCount,
            DealsCount = counts.DealsCount,
            InvestorsCount = counts.InvestorsCount,
            KycsCount = counts.KycsCount,
            OpportunitiesCount = counts.OpportunitiesCount,
            ConsultationsCount = counts.ConsultationsCount,
            PipelineCardsCount = counts.PipelineCardsCount
        };
    }

    public async Task<WorkHandoverDto> StartHandoverAsync(int companyId, int actorId, string actorName, string actorEmail, StartWorkHandoverRequestDto request, CancellationToken ct = default)
    {
        if (request.FromUserId <= 0 || request.ToUserId <= 0)
            throw new ArgumentException("Valid FromUserId and ToUserId are required.");

        if (request.FromUserId == request.ToUserId)
            throw new InvalidOperationException("Source and covering user cannot be the same person.");

        if (string.IsNullOrWhiteSpace(request.Reason))
            throw new ArgumentException("Handover reason is required.");

        var fromUser = await _db.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.Id == request.FromUserId && u.CompanyId == companyId, ct)
            ?? throw new KeyNotFoundException($"Source user ID {request.FromUserId} not found.");

        var toUser = await _db.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.Id == request.ToUserId && u.CompanyId == companyId, ct)
            ?? throw new KeyNotFoundException($"Target user ID {request.ToUserId} not found.");

        if (fromUser.Role.Code.ToLowerInvariant() != toUser.Role.Code.ToLowerInvariant())
            throw new InvalidOperationException($"Role mismatch: Cannot hand over between '{fromUser.Role.Code}' and '{toUser.Role.Code}'. Must be same role.");

        if (toUser.Status != UserStatus.Active)
            throw new InvalidOperationException($"Target user '{toUser.Name}' is not active and cannot receive assignments.");

        // Validation Rules:
        // 1. Source user may have only ONE active handover
        var sourceActive = await _db.WorkHandovers.AnyAsync(h => h.CompanyId == companyId && h.OriginalUserId == request.FromUserId && h.Status == "active", ct);
        if (sourceActive)
            throw new InvalidOperationException($"A handover is already active for {fromUser.Name}. End the existing handover first.");

        // 2. A user who is currently covered (on leave) cannot be the target of a new handover
        var targetIsCovered = await _db.WorkHandovers.AnyAsync(h => h.CompanyId == companyId && h.OriginalUserId == request.ToUserId && h.Status == "active", ct);
        if (targetIsCovered)
            throw new InvalidOperationException($"Target user {toUser.Name} is currently on leave (covered by another user) and cannot cover anyone.");

        // 3. A user who is currently covering someone cannot be handed over to a third user (no chaining)
        var sourceIsCovering = await _db.WorkHandovers.AnyAsync(h => h.CompanyId == companyId && h.CoveringUserId == request.FromUserId && h.Status == "active", ct);
        if (sourceIsCovering)
            throw new InvalidOperationException($"{fromUser.Name} is currently covering another user's work. End the existing handover first.");

        using var tx = await _db.Database.BeginTransactionAsync(ct);

        var handover = new WorkHandover
        {
            CompanyId = companyId,
            RoleCode = fromUser.Role.Code.ToLowerInvariant(),
            OriginalUserId = fromUser.Id,
            CoveringUserId = toUser.Id,
            StartedById = actorId,
            Reason = request.Reason.Trim(),
            StartedAt = DateTime.UtcNow,
            PlannedEndAt = request.PlannedEndAt?.ToUniversalTime(),
            Status = "active"
        };
        _db.WorkHandovers.Add(handover);
        await _db.SaveChangesAsync(ct);

        var items = new List<WorkHandoverItem>();

        // 1. Leads
        var openLeads = await _db.Leads
            .Where(l => l.CompanyId == companyId && l.AssignedAgentId == fromUser.Id &&
                        l.Status != "Converted" && l.Status != "Not Interested" && l.Status != "Junk")
            .ToListAsync(ct);
        foreach (var lead in openLeads)
        {
            lead.AssignedAgentId = toUser.Id;
            lead.HandoverId = handover.Id;
            lead.OriginalOwnerId = fromUser.Id;
            lead.UpdatedAt = DateTime.UtcNow;
            items.Add(new WorkHandoverItem
            {
                HandoverId = handover.Id,
                EntityType = "Lead",
                EntityId = lead.Id,
                Origin = "included_at_start",
                CreatedAt = DateTime.UtcNow
            });
        }

        // 2. Customers
        var customers = await _db.Customers
            .Where(c => c.CompanyId == companyId && c.AssignedAgentId == fromUser.Id)
            .ToListAsync(ct);
        foreach (var customer in customers)
        {
            customer.AssignedAgentId = toUser.Id;
            customer.HandoverId = handover.Id;
            customer.OriginalOwnerId = fromUser.Id;
            customer.UpdatedAt = DateTime.UtcNow;
            items.Add(new WorkHandoverItem
            {
                HandoverId = handover.Id,
                EntityType = "Customer",
                EntityId = customer.Id,
                Origin = "included_at_start",
                CreatedAt = DateTime.UtcNow
            });
        }

        // 3. Pending Follow-ups
        var pendingFollowups = await _db.Followups
            .Where(f => f.CompanyId == companyId && f.AssignedAgentId == fromUser.Id && f.Status == FollowupStatus.Pending)
            .ToListAsync(ct);
        foreach (var followup in pendingFollowups)
        {
            followup.AssignedAgentId = toUser.Id;
            followup.AssignedToName = toUser.Name;
            followup.HandoverId = handover.Id;
            followup.OriginalOwnerId = fromUser.Id;
            followup.UpdatedAt = DateTime.UtcNow;
            items.Add(new WorkHandoverItem
            {
                HandoverId = handover.Id,
                EntityType = "Followup",
                EntityId = followup.Id,
                Origin = "included_at_start",
                CreatedAt = DateTime.UtcNow
            });
        }

        // 4. Open GhlDeals
        var openDeals = await _db.GhlDeals
            .Where(d => d.CompanyId == companyId && d.AssignedAgentId == fromUser.Id &&
                        d.Stage != "won" && d.Stage != "lost" && d.Stage != "converted")
            .ToListAsync(ct);
        foreach (var deal in openDeals)
        {
            deal.AssignedAgentId = toUser.Id;
            deal.HandoverId = handover.Id;
            deal.OriginalOwnerId = fromUser.Id;
            items.Add(new WorkHandoverItem
            {
                HandoverId = handover.Id,
                EntityType = "GhlDeal",
                EntityId = deal.Id,
                Origin = "included_at_start",
                CreatedAt = DateTime.UtcNow
            });
        }

        // 5. GhlInvestors
        var ghlInvestors = await _db.GhlInvestors
            .Where(i => i.CompanyId == companyId && i.AssignedAgentId == fromUser.Id)
            .ToListAsync(ct);
        foreach (var inv in ghlInvestors)
        {
            inv.AssignedAgentId = toUser.Id;
            inv.HandoverId = handover.Id;
            inv.OriginalOwnerId = fromUser.Id;
            items.Add(new WorkHandoverItem
            {
                HandoverId = handover.Id,
                EntityType = "GhlInvestor",
                EntityId = inv.Id,
                Origin = "included_at_start",
                CreatedAt = DateTime.UtcNow
            });
        }

        // 6. Open GhlInvestmentOpportunities
        var openOpps = await _db.GhlInvestmentOpportunities
            .Where(o => o.CompanyId == companyId && o.AssignedAgentId == fromUser.Id &&
                        o.Stage != "Closed Won" && o.Stage != "Closed Lost")
            .ToListAsync(ct);
        foreach (var opp in openOpps)
        {
            opp.AssignedAgentId = toUser.Id;
            opp.HandoverId = handover.Id;
            opp.OriginalOwnerId = fromUser.Id;
            opp.UpdatedAt = DateTime.UtcNow;
            items.Add(new WorkHandoverItem
            {
                HandoverId = handover.Id,
                EntityType = "GhlInvestmentOpportunity",
                EntityId = opp.Id,
                Origin = "included_at_start",
                CreatedAt = DateTime.UtcNow
            });
        }

        // 7. Scheduled Consultations
        var consultations = await _db.Consultations
            .Where(c => c.CompanyId == companyId && c.ConsultantId == fromUser.Id && c.Status == ConsultationStatus.Scheduled)
            .ToListAsync(ct);
        foreach (var cons in consultations)
        {
            cons.ConsultantId = toUser.Id;
            cons.ConsultantName = toUser.Name;
            cons.HandoverId = handover.Id;
            cons.OriginalOwnerId = fromUser.Id;
            cons.UpdatedAt = DateTime.UtcNow;
            items.Add(new WorkHandoverItem
            {
                HandoverId = handover.Id,
                EntityType = "Consultation",
                EntityId = cons.Id,
                Origin = "included_at_start",
                CreatedAt = DateTime.UtcNow
            });
        }

        // 8. Investors (IRM)
        var investors = await _db.Investors
            .Where(i => i.CompanyId == companyId && i.AssignedIrmId == fromUser.Id)
            .ToListAsync(ct);
        foreach (var inv in investors)
        {
            inv.AssignedIrmId = toUser.Id;
            inv.AssignedIrmName = toUser.Name;
            inv.HandoverId = handover.Id;
            inv.OriginalOwnerId = fromUser.Id;
            inv.UpdatedAt = DateTime.UtcNow;
            items.Add(new WorkHandoverItem
            {
                HandoverId = handover.Id,
                EntityType = "Investor",
                EntityId = inv.Id,
                Origin = "included_at_start",
                CreatedAt = DateTime.UtcNow
            });
        }

        // 9. Open InvestorKycs
        var kycs = await _db.InvestorKycs
            .Where(k => k.CompanyId == companyId && k.IrmId == fromUser.Id &&
                        k.Status != KycStatus.Approved && k.Status != KycStatus.Rejected)
            .ToListAsync(ct);
        foreach (var kyc in kycs)
        {
            kyc.IrmId = toUser.Id;
            kyc.HandoverId = handover.Id;
            kyc.OriginalOwnerId = fromUser.Id;
            kyc.UpdatedAt = DateTime.UtcNow;
            items.Add(new WorkHandoverItem
            {
                HandoverId = handover.Id,
                EntityType = "InvestorKyc",
                EntityId = kyc.Id,
                Origin = "included_at_start",
                CreatedAt = DateTime.UtcNow
            });
        }

        // 10. IrmPipelineCards
        var cards = await _db.IrmPipelineCards
            .Where(c => c.CompanyId == companyId && c.AssignedIrmId == fromUser.Id)
            .ToListAsync(ct);
        foreach (var card in cards)
        {
            card.AssignedIrmId = toUser.Id;
            card.AssignedIrmName = toUser.Name;
            card.HandoverId = handover.Id;
            card.OriginalOwnerId = fromUser.Id;
            card.UpdatedAt = DateTime.UtcNow;
            items.Add(new WorkHandoverItem
            {
                HandoverId = handover.Id,
                EntityType = "IrmPipelineCard",
                EntityId = card.Id,
                Origin = "included_at_start",
                CreatedAt = DateTime.UtcNow
            });
        }

        _db.WorkHandoverItems.AddRange(items);

        // Audit Log
        _db.AuditLogs.Add(new AuditLog
        {
            CompanyId = companyId,
            Timestamp = DateTime.UtcNow,
            ActorName = actorName,
            ActorEmail = actorEmail,
            Action = "START_WORK_HANDOVER",
            EntityType = "WorkHandover",
            EntityId = handover.Id.ToString(),
            Details = $"Handed over {items.Count} records from {fromUser.Name} ({fromUser.Role.Code}) to {toUser.Name}. Reason: {request.Reason}",
            Module = "WORK_HANDOVER",
            Status = "success"
        });

        // Notification to Covering User
        _db.Notifications.Add(new Notification
        {
            CompanyId = companyId,
            UserId = toUser.Id,
            Title = "Work Coverage Assigned",
            Message = $"{items.Count} items handed over from {fromUser.Name}. Reason: {request.Reason}",
            Type = "info",
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        });

        // Optional LeaveRequest link (Spec §4.3)
        if (request.LeaveRequestId.HasValue)
        {
            var lr = await _db.LeaveRequests.FirstOrDefaultAsync(l => l.Id == request.LeaveRequestId.Value && l.CompanyId == companyId, ct);
            if (lr != null && lr.UserId == fromUser.Id)
            {
                handover.LeaveRequestId = lr.Id;
                lr.HandoverDecision = "arranged";
                lr.WorkHandoverId = handover.Id;
                lr.UpdatedAt = DateTime.UtcNow;

                _db.LeaveRequestEvents.Add(new LeaveRequestEvent
                {
                    LeaveRequestId = lr.Id,
                    Action = "handover_linked",
                    ActorId = actorId,
                    Note = $"Work handover #{handover.Id} arranged with covering user {toUser.Name}.",
                    At = DateTime.UtcNow
                });
            }
        }

        await _db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return await BuildDtoAsync(handover.Id, ct);
    }

    public async Task<List<WorkHandoverDto>> GetActiveHandoversAsync(int companyId, CancellationToken ct = default)
    {
        var handovers = await _db.WorkHandovers
            .Include(h => h.OriginalUser)
            .Include(h => h.CoveringUser)
            .Include(h => h.StartedBy)
            .Include(h => h.Items)
            .Where(h => h.CompanyId == companyId && h.Status == "active")
            .OrderByDescending(h => h.StartedAt)
            .ToListAsync(ct);

        var list = new List<WorkHandoverDto>();
        foreach (var h in handovers)
        {
            var dto = await MapToDtoAsync(h, ct);
            list.Add(dto);
        }
        return list;
    }

    public async Task<List<WorkHandoverDto>> GetHandoverHistoryAsync(int companyId, CancellationToken ct = default)
    {
        var handovers = await _db.WorkHandovers
            .Include(h => h.OriginalUser)
            .Include(h => h.CoveringUser)
            .Include(h => h.StartedBy)
            .Include(h => h.EndedBy)
            .Include(h => h.Items)
            .Where(h => h.CompanyId == companyId && h.Status == "ended")
            .OrderByDescending(h => h.EndedAt ?? h.StartedAt)
            .ToListAsync(ct);

        var list = new List<WorkHandoverDto>();
        foreach (var h in handovers)
        {
            var dto = await MapToDtoAsync(h, ct);
            list.Add(dto);
        }
        return list;
    }

    public async Task<WorkHandoverDto?> GetHandoverByIdAsync(int companyId, int id, CancellationToken ct = default)
    {
        var handover = await _db.WorkHandovers
            .Include(h => h.OriginalUser)
            .Include(h => h.CoveringUser)
            .Include(h => h.StartedBy)
            .Include(h => h.EndedBy)
            .Include(h => h.Items)
            .FirstOrDefaultAsync(h => h.Id == id && h.CompanyId == companyId, ct);

        if (handover == null) return null;
        return await MapToDtoAsync(handover, ct);
    }

    public async Task<WorkHandoverDto> EndHandoverAsync(int companyId, int id, int actorId, string actorName, string actorEmail, CancellationToken ct = default)
    {
        var handover = await _db.WorkHandovers
            .Include(h => h.OriginalUser)
            .Include(h => h.CoveringUser)
            .Include(h => h.Items)
            .FirstOrDefaultAsync(h => h.Id == id && h.CompanyId == companyId, ct)
            ?? throw new KeyNotFoundException($"Handover #{id} not found.");

        if (handover.Status != "active")
            throw new InvalidOperationException($"Handover #{id} is already ended.");

        using var tx = await _db.Database.BeginTransactionAsync(ct);

        int returnedCount = 0;
        int skippedCount = 0;

        var activeItems = handover.Items.Where(i => i.ReturnedAt == null).ToList();

        foreach (var item in activeItems)
        {
            bool isReassigned = false;
            switch (item.EntityType)
            {
                case "Lead":
                    var lead = await _db.Leads.FirstOrDefaultAsync(l => l.Id == item.EntityId, ct);
                    if (lead != null)
                    {
                        if (lead.AssignedAgentId == handover.CoveringUserId)
                        {
                            lead.AssignedAgentId = handover.OriginalUserId;
                            lead.HandoverId = null;
                            lead.OriginalOwnerId = null;
                            lead.UpdatedAt = DateTime.UtcNow;
                            item.ReturnedAt = DateTime.UtcNow;
                            item.ReturnOutcome = "returned";
                            returnedCount++;
                        }
                        else
                        {
                            isReassigned = true;
                        }
                    }
                    break;

                case "Customer":
                    var customer = await _db.Customers.FirstOrDefaultAsync(c => c.Id == item.EntityId, ct);
                    if (customer != null)
                    {
                        if (customer.AssignedAgentId == handover.CoveringUserId)
                        {
                            customer.AssignedAgentId = handover.OriginalUserId;
                            customer.HandoverId = null;
                            customer.OriginalOwnerId = null;
                            customer.UpdatedAt = DateTime.UtcNow;
                            item.ReturnedAt = DateTime.UtcNow;
                            item.ReturnOutcome = "returned";
                            returnedCount++;
                        }
                        else
                        {
                            isReassigned = true;
                        }
                    }
                    break;

                case "Followup":
                    var followup = await _db.Followups.FirstOrDefaultAsync(f => f.Id == item.EntityId, ct);
                    if (followup != null)
                    {
                        if (followup.AssignedAgentId == handover.CoveringUserId)
                        {
                            followup.AssignedAgentId = handover.OriginalUserId;
                            followup.AssignedToName = handover.OriginalUser?.Name ?? string.Empty;
                            followup.HandoverId = null;
                            followup.OriginalOwnerId = null;
                            followup.UpdatedAt = DateTime.UtcNow;
                            item.ReturnedAt = DateTime.UtcNow;
                            item.ReturnOutcome = "returned";
                            returnedCount++;
                        }
                        else
                        {
                            isReassigned = true;
                        }
                    }
                    break;

                case "GhlDeal":
                    var deal = await _db.GhlDeals.FirstOrDefaultAsync(d => d.Id == item.EntityId, ct);
                    if (deal != null)
                    {
                        if (deal.AssignedAgentId == handover.CoveringUserId)
                        {
                            deal.AssignedAgentId = handover.OriginalUserId;
                            deal.HandoverId = null;
                            deal.OriginalOwnerId = null;
                            item.ReturnedAt = DateTime.UtcNow;
                            item.ReturnOutcome = "returned";
                            returnedCount++;
                        }
                        else
                        {
                            isReassigned = true;
                        }
                    }
                    break;

                case "GhlInvestor":
                    var ghlInv = await _db.GhlInvestors.FirstOrDefaultAsync(i => i.Id == item.EntityId, ct);
                    if (ghlInv != null)
                    {
                        if (ghlInv.AssignedAgentId == handover.CoveringUserId)
                        {
                            ghlInv.AssignedAgentId = handover.OriginalUserId;
                            ghlInv.HandoverId = null;
                            ghlInv.OriginalOwnerId = null;
                            item.ReturnedAt = DateTime.UtcNow;
                            item.ReturnOutcome = "returned";
                            returnedCount++;
                        }
                        else
                        {
                            isReassigned = true;
                        }
                    }
                    break;

                case "GhlInvestmentOpportunity":
                    var opp = await _db.GhlInvestmentOpportunities.FirstOrDefaultAsync(o => o.Id == item.EntityId, ct);
                    if (opp != null)
                    {
                        if (opp.AssignedAgentId == handover.CoveringUserId)
                        {
                            opp.AssignedAgentId = handover.OriginalUserId;
                            opp.HandoverId = null;
                            opp.OriginalOwnerId = null;
                            opp.UpdatedAt = DateTime.UtcNow;
                            item.ReturnedAt = DateTime.UtcNow;
                            item.ReturnOutcome = "returned";
                            returnedCount++;
                        }
                        else
                        {
                            isReassigned = true;
                        }
                    }
                    break;

                case "Consultation":
                    var cons = await _db.Consultations.FirstOrDefaultAsync(c => c.Id == item.EntityId, ct);
                    if (cons != null)
                    {
                        if (cons.ConsultantId == handover.CoveringUserId)
                        {
                            cons.ConsultantId = handover.OriginalUserId;
                            cons.ConsultantName = handover.OriginalUser?.Name ?? string.Empty;
                            cons.HandoverId = null;
                            cons.OriginalOwnerId = null;
                            cons.UpdatedAt = DateTime.UtcNow;
                            item.ReturnedAt = DateTime.UtcNow;
                            item.ReturnOutcome = "returned";
                            returnedCount++;
                        }
                        else
                        {
                            isReassigned = true;
                        }
                    }
                    break;

                case "Investor":
                    var inv = await _db.Investors.FirstOrDefaultAsync(i => i.Id == item.EntityId, ct);
                    if (inv != null)
                    {
                        if (inv.AssignedIrmId == handover.CoveringUserId)
                        {
                            inv.AssignedIrmId = handover.OriginalUserId;
                            inv.AssignedIrmName = handover.OriginalUser?.Name ?? string.Empty;
                            inv.HandoverId = null;
                            inv.OriginalOwnerId = null;
                            inv.UpdatedAt = DateTime.UtcNow;
                            item.ReturnedAt = DateTime.UtcNow;
                            item.ReturnOutcome = "returned";
                            returnedCount++;
                        }
                        else
                        {
                            isReassigned = true;
                        }
                    }
                    break;

                case "InvestorKyc":
                    var kyc = await _db.InvestorKycs.FirstOrDefaultAsync(k => k.Id == item.EntityId, ct);
                    if (kyc != null)
                    {
                        if (kyc.IrmId == handover.CoveringUserId)
                        {
                            kyc.IrmId = handover.OriginalUserId;
                            kyc.HandoverId = null;
                            kyc.OriginalOwnerId = null;
                            kyc.UpdatedAt = DateTime.UtcNow;
                            item.ReturnedAt = DateTime.UtcNow;
                            item.ReturnOutcome = "returned";
                            returnedCount++;
                        }
                        else
                        {
                            isReassigned = true;
                        }
                    }
                    break;

                case "IrmPipelineCard":
                    var card = await _db.IrmPipelineCards.FirstOrDefaultAsync(c => c.Id == item.EntityId, ct);
                    if (card != null)
                    {
                        if (card.AssignedIrmId == handover.CoveringUserId)
                        {
                            card.AssignedIrmId = handover.OriginalUserId;
                            card.AssignedIrmName = handover.OriginalUser?.Name ?? string.Empty;
                            card.HandoverId = null;
                            card.OriginalOwnerId = null;
                            card.UpdatedAt = DateTime.UtcNow;
                            item.ReturnedAt = DateTime.UtcNow;
                            item.ReturnOutcome = "returned";
                            returnedCount++;
                        }
                        else
                        {
                            isReassigned = true;
                        }
                    }
                    break;
            }

            if (isReassigned)
            {
                item.ReturnedAt = DateTime.UtcNow;
                item.ReturnOutcome = "skipped_reassigned";
                skippedCount++;
            }
        }

        // Build Return Summary Progress
        var progress = await CalculateProgressAsync(handover, ct);
        progress.RecordsSkippedCount = skippedCount;

        handover.Status = "ended";
        handover.EndedAt = DateTime.UtcNow;
        handover.EndedById = actorId;
        handover.ReturnSummaryJson = JsonSerializer.Serialize(progress);

        // Audit Log
        _db.AuditLogs.Add(new AuditLog
        {
            CompanyId = companyId,
            Timestamp = DateTime.UtcNow,
            ActorName = actorName,
            ActorEmail = actorEmail,
            Action = "END_WORK_HANDOVER",
            EntityType = "WorkHandover",
            EntityId = handover.Id.ToString(),
            Details = $"Ended handover #{handover.Id}. Reverted {returnedCount} records to {handover.OriginalUser?.Name} (Skipped {skippedCount} reassigned). Calls made during coverage: {progress.CallsMadeCount}, Follow-ups done: {progress.FollowupsCompletedCount}.",
            Module = "WORK_HANDOVER",
            Status = "success"
        });

        // Notification to Original User (SE1)
        _db.Notifications.Add(new Notification
        {
            CompanyId = companyId,
            UserId = handover.OriginalUserId,
            Title = "Work Handover Completed",
            Message = $"Your coverage by {handover.CoveringUser?.Name} has ended. {returnedCount} records returned with latest progress ({progress.CallsMadeCount} calls made, {progress.FollowupsCompletedCount} follow-ups completed).",
            Type = "info",
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return await BuildDtoAsync(handover.Id, ct);
    }

    public async Task<WorkHandoverDto> ReturnSelectedItemsAsync(int companyId, int id, List<int> itemIds, int actorId, string actorName, string actorEmail, CancellationToken ct = default)
    {
        var handover = await _db.WorkHandovers
            .Include(h => h.OriginalUser)
            .Include(h => h.CoveringUser)
            .Include(h => h.Items)
            .FirstOrDefaultAsync(h => h.Id == id && h.CompanyId == companyId, ct)
            ?? throw new KeyNotFoundException($"Handover #{id} not found.");

        if (handover.Status != "active")
            throw new InvalidOperationException($"Handover #{id} is not active.");

        var selectedItems = handover.Items
            .Where(i => itemIds.Contains(i.Id) && i.ReturnedAt == null)
            .ToList();

        if (selectedItems.Count == 0)
            throw new InvalidOperationException("No eligible active items found to return.");

        using var tx = await _db.Database.BeginTransactionAsync(ct);

        int returnedCount = 0;
        foreach (var item in selectedItems)
        {
            switch (item.EntityType)
            {
                case "Lead":
                    var lead = await _db.Leads.FirstOrDefaultAsync(l => l.Id == item.EntityId, ct);
                    if (lead != null && lead.AssignedAgentId == handover.CoveringUserId)
                    {
                        lead.AssignedAgentId = handover.OriginalUserId;
                        lead.HandoverId = null;
                        lead.OriginalOwnerId = null;
                        lead.UpdatedAt = DateTime.UtcNow;
                        item.ReturnedAt = DateTime.UtcNow;
                        item.ReturnOutcome = "returned";
                        returnedCount++;
                    }
                    break;

                case "Customer":
                    var cust = await _db.Customers.FirstOrDefaultAsync(c => c.Id == item.EntityId, ct);
                    if (cust != null && cust.AssignedAgentId == handover.CoveringUserId)
                    {
                        cust.AssignedAgentId = handover.OriginalUserId;
                        cust.HandoverId = null;
                        cust.OriginalOwnerId = null;
                        cust.UpdatedAt = DateTime.UtcNow;
                        item.ReturnedAt = DateTime.UtcNow;
                        item.ReturnOutcome = "returned";
                        returnedCount++;
                    }
                    break;

                case "Followup":
                    var f = await _db.Followups.FirstOrDefaultAsync(f => f.Id == item.EntityId, ct);
                    if (f != null && f.AssignedAgentId == handover.CoveringUserId)
                    {
                        f.AssignedAgentId = handover.OriginalUserId;
                        f.AssignedToName = handover.OriginalUser?.Name ?? string.Empty;
                        f.HandoverId = null;
                        f.OriginalOwnerId = null;
                        f.UpdatedAt = DateTime.UtcNow;
                        item.ReturnedAt = DateTime.UtcNow;
                        item.ReturnOutcome = "returned";
                        returnedCount++;
                    }
                    break;

                case "GhlDeal":
                    var d = await _db.GhlDeals.FirstOrDefaultAsync(d => d.Id == item.EntityId, ct);
                    if (d != null && d.AssignedAgentId == handover.CoveringUserId)
                    {
                        d.AssignedAgentId = handover.OriginalUserId;
                        d.HandoverId = null;
                        d.OriginalOwnerId = null;
                        item.ReturnedAt = DateTime.UtcNow;
                        item.ReturnOutcome = "returned";
                        returnedCount++;
                    }
                    break;

                case "Investor":
                    var inv = await _db.Investors.FirstOrDefaultAsync(i => i.Id == item.EntityId, ct);
                    if (inv != null && inv.AssignedIrmId == handover.CoveringUserId)
                    {
                        inv.AssignedIrmId = handover.OriginalUserId;
                        inv.AssignedIrmName = handover.OriginalUser?.Name ?? string.Empty;
                        inv.HandoverId = null;
                        inv.OriginalOwnerId = null;
                        inv.UpdatedAt = DateTime.UtcNow;
                        item.ReturnedAt = DateTime.UtcNow;
                        item.ReturnOutcome = "returned";
                        returnedCount++;
                    }
                    break;

                case "InvestorKyc":
                    var kyc = await _db.InvestorKycs.FirstOrDefaultAsync(k => k.Id == item.EntityId, ct);
                    if (kyc != null && kyc.IrmId == handover.CoveringUserId)
                    {
                        kyc.IrmId = handover.OriginalUserId;
                        kyc.HandoverId = null;
                        kyc.OriginalOwnerId = null;
                        kyc.UpdatedAt = DateTime.UtcNow;
                        item.ReturnedAt = DateTime.UtcNow;
                        item.ReturnOutcome = "returned";
                        returnedCount++;
                    }
                    break;

                case "Consultation":
                    var cons = await _db.Consultations.FirstOrDefaultAsync(c => c.Id == item.EntityId, ct);
                    if (cons != null && cons.ConsultantId == handover.CoveringUserId)
                    {
                        cons.ConsultantId = handover.OriginalUserId;
                        cons.ConsultantName = handover.OriginalUser?.Name ?? string.Empty;
                        cons.HandoverId = null;
                        cons.OriginalOwnerId = null;
                        cons.UpdatedAt = DateTime.UtcNow;
                        item.ReturnedAt = DateTime.UtcNow;
                        item.ReturnOutcome = "returned";
                        returnedCount++;
                    }
                    break;

                case "GhlInvestor":
                    var ghlInv = await _db.GhlInvestors.FirstOrDefaultAsync(i => i.Id == item.EntityId, ct);
                    if (ghlInv != null && ghlInv.AssignedAgentId == handover.CoveringUserId)
                    {
                        ghlInv.AssignedAgentId = handover.OriginalUserId;
                        ghlInv.HandoverId = null;
                        ghlInv.OriginalOwnerId = null;
                        item.ReturnedAt = DateTime.UtcNow;
                        item.ReturnOutcome = "returned";
                        returnedCount++;
                    }
                    break;

                case "GhlInvestmentOpportunity":
                    var opp = await _db.GhlInvestmentOpportunities.FirstOrDefaultAsync(o => o.Id == item.EntityId, ct);
                    if (opp != null && opp.AssignedAgentId == handover.CoveringUserId)
                    {
                        opp.AssignedAgentId = handover.OriginalUserId;
                        opp.HandoverId = null;
                        opp.OriginalOwnerId = null;
                        opp.UpdatedAt = DateTime.UtcNow;
                        item.ReturnedAt = DateTime.UtcNow;
                        item.ReturnOutcome = "returned";
                        returnedCount++;
                    }
                    break;

                case "IrmPipelineCard":
                    var card = await _db.IrmPipelineCards.FirstOrDefaultAsync(c => c.Id == item.EntityId, ct);
                    if (card != null && card.AssignedIrmId == handover.CoveringUserId)
                    {
                        card.AssignedIrmId = handover.OriginalUserId;
                        card.AssignedIrmName = handover.OriginalUser?.Name ?? string.Empty;
                        card.HandoverId = null;
                        card.OriginalOwnerId = null;
                        card.UpdatedAt = DateTime.UtcNow;
                        item.ReturnedAt = DateTime.UtcNow;
                        item.ReturnOutcome = "returned";
                        returnedCount++;
                    }
                    break;
            }
        }

        // If no more items are left active, mark the entire handover as ended
        var remainingActive = handover.Items.Count(i => i.ReturnedAt == null);
        if (remainingActive == 0)
        {
            handover.Status = "ended";
            handover.EndedAt = DateTime.UtcNow;
            handover.EndedById = actorId;
            var summary = await CalculateProgressAsync(handover, ct);
            handover.ReturnSummaryJson = JsonSerializer.Serialize(summary);
        }

        _db.AuditLogs.Add(new AuditLog
        {
            CompanyId = companyId,
            Timestamp = DateTime.UtcNow,
            ActorName = actorName,
            ActorEmail = actorEmail,
            Action = "RETURN_HANDOVER_ITEMS",
            EntityType = "WorkHandover",
            EntityId = handover.Id.ToString(),
            Details = $"Returned {returnedCount} selected items from covering user {handover.CoveringUser?.Name} back to {handover.OriginalUser?.Name}.",
            Module = "WORK_HANDOVER",
            Status = "success"
        });

        await _db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return await BuildDtoAsync(handover.Id, ct);
    }

    public async Task<WorkHandover?> GetActiveHandoverForCoveringUserAsync(int companyId, int coveringUserId, CancellationToken ct = default)
    {
        return await _db.WorkHandovers
            .Include(h => h.OriginalUser)
            .FirstOrDefaultAsync(h => h.CompanyId == companyId && h.CoveringUserId == coveringUserId && h.Status == "active", ct);
    }

    public async Task<WorkHandover?> GetActiveHandoverForCoveredUserAsync(int companyId, int coveredUserId, CancellationToken ct = default)
    {
        return await _db.WorkHandovers
            .Include(h => h.CoveringUser)
            .FirstOrDefaultAsync(h => h.CompanyId == companyId && h.OriginalUserId == coveredUserId && h.Status == "active", ct);
    }

    public async Task<MyWorkHandoverStatusDto> GetMyStatusAsync(int companyId, int userId, CancellationToken ct = default)
    {
        var status = new MyWorkHandoverStatusDto();

        var activeCoverage = await _db.WorkHandovers
            .Include(h => h.OriginalUser)
            .Include(h => h.CoveringUser)
            .Include(h => h.StartedBy)
            .Include(h => h.EndedBy)
            .Include(h => h.Items)
            .FirstOrDefaultAsync(h => h.CompanyId == companyId && h.OriginalUserId == userId && h.Status == "active", ct);

        if (activeCoverage != null)
        {
            status.ActiveCoverage = await MapToDtoAsync(activeCoverage, ct);
        }

        var activeCovering = await _db.WorkHandovers
            .Include(h => h.OriginalUser)
            .Include(h => h.CoveringUser)
            .Include(h => h.StartedBy)
            .Include(h => h.EndedBy)
            .Include(h => h.Items)
            .FirstOrDefaultAsync(h => h.CompanyId == companyId && h.CoveringUserId == userId && h.Status == "active", ct);

        if (activeCovering != null)
        {
            status.ActiveCovering = await MapToDtoAsync(activeCovering, ct);
        }

        var recentlyEnded = await _db.WorkHandovers
            .Include(h => h.OriginalUser)
            .Include(h => h.CoveringUser)
            .Include(h => h.StartedBy)
            .Include(h => h.EndedBy)
            .Include(h => h.Items)
            .Where(h => h.CompanyId == companyId && h.OriginalUserId == userId && h.Status == "ended")
            .OrderByDescending(h => h.EndedAt)
            .FirstOrDefaultAsync(ct);

        if (recentlyEnded != null)
        {
            status.RecentlyEnded = await MapToDtoAsync(recentlyEnded, ct);
        }

        return status;
    }

    private async Task<WorkHandoverCountsDto> CalculateCountsAsync(int companyId, int userId, CancellationToken ct)
    {
        var leads = await _db.Leads.CountAsync(l => l.CompanyId == companyId && l.AssignedAgentId == userId &&
            l.Status != "Converted" && l.Status != "Not Interested" && l.Status != "Junk", ct);
        var customers = await _db.Customers.CountAsync(c => c.CompanyId == companyId && c.AssignedAgentId == userId, ct);
        var followups = await _db.Followups.CountAsync(f => f.CompanyId == companyId && f.AssignedAgentId == userId && f.Status == FollowupStatus.Pending, ct);
        var deals = await _db.GhlDeals.CountAsync(d => d.CompanyId == companyId && d.AssignedAgentId == userId &&
            d.Stage != "won" && d.Stage != "lost" && d.Stage != "converted", ct);
        var ghlInvestors = await _db.GhlInvestors.CountAsync(i => i.CompanyId == companyId && i.AssignedAgentId == userId, ct);
        var opps = await _db.GhlInvestmentOpportunities.CountAsync(o => o.CompanyId == companyId && o.AssignedAgentId == userId &&
            o.Stage != "Closed Won" && o.Stage != "Closed Lost", ct);
        var consults = await _db.Consultations.CountAsync(c => c.CompanyId == companyId && c.ConsultantId == userId && c.Status == ConsultationStatus.Scheduled, ct);
        var investors = await _db.Investors.CountAsync(i => i.CompanyId == companyId && i.AssignedIrmId == userId, ct);
        var kycs = await _db.InvestorKycs.CountAsync(k => k.CompanyId == companyId && k.IrmId == userId &&
            k.Status != KycStatus.Approved && k.Status != KycStatus.Rejected, ct);
        var cards = await _db.IrmPipelineCards.CountAsync(c => c.CompanyId == companyId && c.AssignedIrmId == userId, ct);

        return new WorkHandoverCountsDto
        {
            LeadsCount = leads,
            CustomersCount = customers,
            FollowupsCount = followups,
            DealsCount = deals,
            InvestorsCount = investors + ghlInvestors,
            KycsCount = kycs,
            OpportunitiesCount = opps,
            ConsultationsCount = consults,
            PipelineCardsCount = cards
        };
    }

    private async Task<WorkHandoverProgressDto> CalculateProgressAsync(WorkHandover handover, CancellationToken ct)
    {
        var itemIds = handover.Items.Select(i => i.EntityId).ToList();
        var startTime = handover.StartedAt;
        var endTime = handover.EndedAt ?? DateTime.UtcNow;

        // 1. Calls made by covering user
        var callsCount = await _db.CallRecords
            .CountAsync(c => c.CompanyId == handover.CompanyId && c.AgentId == handover.CoveringUserId &&
                             c.Timestamp >= startTime && c.Timestamp <= endTime, ct);
        var investorCallsCount = await _db.InvestorCalls
            .CountAsync(c => c.CompanyId == handover.CompanyId && c.IrmId == handover.CoveringUserId &&
                             c.CalledAt >= startTime && c.CalledAt <= endTime, ct);

        // 2. Follow-ups completed
        var followupsCompleted = await _db.Followups
            .CountAsync(f => f.HandoverId == handover.Id && f.Status == FollowupStatus.Completed, ct);

        // 3. New records created during coverage
        var createdCount = handover.Items.Count(i => i.Origin == "created_during_coverage");

        // 4. Closed / Converted records
        var convertedLeads = await _db.Leads
            .CountAsync(l => l.HandoverId == handover.Id && (l.Status == "Converted" || l.Status == "Not Interested" || l.Status == "Junk"), ct);
        var closedDeals = await _db.GhlDeals
            .CountAsync(d => d.HandoverId == handover.Id && (d.Stage == "won" || d.Stage == "lost" || d.Stage == "converted"), ct);

        return new WorkHandoverProgressDto
        {
            CallsMadeCount = callsCount + investorCallsCount,
            FollowupsCompletedCount = followupsCompleted,
            StatusChangesCount = convertedLeads + closedDeals,
            NewRecordsCreatedCount = createdCount,
            RecordsConvertedOrClosedCount = convertedLeads + closedDeals,
            Highlights = new List<string>
            {
                $"{callsCount + investorCallsCount} calls connected",
                $"{followupsCompleted} follow-ups completed",
                $"{createdCount} new records created during coverage"
            }
        };
    }

    private async Task<WorkHandoverDto> BuildDtoAsync(int id, CancellationToken ct)
    {
        var handover = await _db.WorkHandovers
            .Include(h => h.OriginalUser)
            .Include(h => h.CoveringUser)
            .Include(h => h.StartedBy)
            .Include(h => h.EndedBy)
            .Include(h => h.Items)
            .FirstAsync(h => h.Id == id, ct);

        return await MapToDtoAsync(handover, ct);
    }

    private async Task<WorkHandoverDto> MapToDtoAsync(WorkHandover h, CancellationToken ct)
    {
        WorkHandoverProgressDto? progress = null;
        if (!string.IsNullOrEmpty(h.ReturnSummaryJson))
        {
            try
            {
                progress = JsonSerializer.Deserialize<WorkHandoverProgressDto>(h.ReturnSummaryJson);
            }
            catch { }
        }

        if (progress == null && h.Status == "active")
        {
            progress = await CalculateProgressAsync(h, ct);
        }

        var itemDtos = new List<WorkHandoverItemDto>();
        foreach (var i in h.Items.OrderByDescending(x => x.CreatedAt))
        {
            itemDtos.Add(new WorkHandoverItemDto
            {
                Id = i.Id,
                HandoverId = i.HandoverId,
                EntityType = i.EntityType,
                EntityId = i.EntityId,
                EntityTitle = $"{i.EntityType} #{i.EntityId}",
                Origin = i.Origin,
                ReturnedAt = i.ReturnedAt,
                ReturnOutcome = i.ReturnOutcome,
                CreatedAt = i.CreatedAt
            });
        }

        return new WorkHandoverDto
        {
            Id = h.Id,
            CompanyId = h.CompanyId,
            RoleCode = h.RoleCode,
            OriginalUserId = h.OriginalUserId,
            OriginalUserName = h.OriginalUser?.Name ?? $"User #{h.OriginalUserId}",
            OriginalUserEmail = h.OriginalUser?.Email ?? string.Empty,
            CoveringUserId = h.CoveringUserId,
            CoveringUserName = h.CoveringUser?.Name ?? $"User #{h.CoveringUserId}",
            CoveringUserEmail = h.CoveringUser?.Email ?? string.Empty,
            StartedById = h.StartedById,
            StartedByName = h.StartedBy?.Name ?? $"User #{h.StartedById}",
            Reason = h.Reason,
            StartedAt = h.StartedAt,
            PlannedEndAt = h.PlannedEndAt,
            Status = h.Status,
            EndedAt = h.EndedAt,
            EndedById = h.EndedById,
            EndedByName = h.EndedBy?.Name,
            Progress = progress,
            TotalItemsCount = h.Items.Count,
            ActiveItemsCount = h.Items.Count(x => x.ReturnedAt == null),
            Items = itemDtos
        };
    }

    public async Task<List<backend.DTOs.Admin.CoverSuggestionDto>> GetCoverSuggestionsAsync(int companyId, int fromUserId, DateOnly? from, DateOnly? to, CancellationToken ct = default)
    {
        var fromUser = await _db.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.Id == fromUserId && u.CompanyId == companyId, ct);
        if (fromUser == null || fromUser.Role == null) return new List<backend.DTOs.Admin.CoverSuggestionDto>();

        var roleCode = fromUser.Role.Code;
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var fromDate = from ?? today;
        var toDate = to ?? today;

        var candidates = await _db.Users
            .Include(u => u.Role)
            .Where(u => u.CompanyId == companyId && u.Role != null && u.Role.Code == roleCode && u.Id != fromUserId && u.Status == backend.Models.Enums.UserStatus.Active)
            .ToListAsync(ct);

        var activeHandovers = await _db.WorkHandovers
            .Where(wh => wh.CompanyId == companyId && wh.Status == "active")
            .ToListAsync(ct);

        var approvedLeaves = await _db.LeaveRequests
            .Where(lr => lr.CompanyId == companyId && lr.Status == "Approved" && lr.StartDate <= toDate && fromDate <= lr.EndDate)
            .ToListAsync(ct);

        var suggestions = new List<backend.DTOs.Admin.CoverSuggestionDto>();

        foreach (var c in candidates)
        {
            var isCovered = activeHandovers.Any(wh => wh.OriginalUserId == c.Id);
            var onLeave = approvedLeaves.Any(lr => lr.UserId == c.Id);
            var isCovering = activeHandovers.Any(wh => wh.CoveringUserId == c.Id);

            bool disabled = isCovered || onLeave;
            string? disabledReason = null;
            if (isCovered) disabledReason = "Currently covered by another handover";
            else if (onLeave)
            {
                var leave = approvedLeaves.First(lr => lr.UserId == c.Id);
                disabledReason = $"On approved leave ({leave.StartDate:d MMM} - {leave.EndDate:d MMM})";
            }

            int openItems = 0;
            if (roleCode == "sales_executive")
            {
                var openLeads = await _db.Leads.CountAsync(l => l.CompanyId == companyId && l.AssignedAgentId == c.Id && l.Status != "Converted" && l.Status != "Not Interested" && l.Status != "Junk", ct);
                var pendingFollowups = await _db.Followups.CountAsync(f => f.CompanyId == companyId && f.AssignedAgentId == c.Id && f.Status == FollowupStatus.Pending, ct);
                var openDeals = await _db.GhlDeals.CountAsync(d => d.CompanyId == companyId && d.AssignedAgentId == c.Id && d.Stage != "won" && d.Stage != "lost" && d.Stage != "converted", ct);
                openItems = openLeads + pendingFollowups + openDeals;
            }
            else if (roleCode == "irm")
            {
                var openInvestors = await _db.Investors.CountAsync(i => i.CompanyId == companyId && i.AssignedIrmId == c.Id, ct);
                var openKycs = await _db.InvestorKycs.CountAsync(k => k.CompanyId == companyId && k.IrmId == c.Id && k.Status != KycStatus.Approved && k.Status != KycStatus.Rejected, ct);
                var openConsultations = await _db.Consultations.CountAsync(con => con.CompanyId == companyId && con.ConsultantId == c.Id && con.Status == ConsultationStatus.Scheduled, ct);
                var openCards = await _db.IrmPipelineCards.CountAsync(card => card.CompanyId == companyId && card.AssignedIrmId == c.Id, ct);
                openItems = openInvestors + openKycs + openConsultations + openCards;
            }

            suggestions.Add(new backend.DTOs.Admin.CoverSuggestionDto
            {
                UserId = c.Id,
                Name = c.Name,
                Email = c.Email,
                RoleCode = roleCode,
                OpenItemCount = openItems,
                CurrentlyCovering = isCovering,
                Disabled = disabled,
                DisabledReason = disabledReason,
                IsRecommended = false
            });
        }

        // Sort by eligible first (not disabled), then by openItemCount ascending
        var sorted = suggestions
            .OrderBy(s => s.Disabled ? 1 : 0)
            .ThenBy(s => s.OpenItemCount)
            .ToList();

        var firstEligible = sorted.FirstOrDefault(s => !s.Disabled);
        if (firstEligible != null)
        {
            firstEligible.IsRecommended = true;
        }

        return sorted;
    }
}
