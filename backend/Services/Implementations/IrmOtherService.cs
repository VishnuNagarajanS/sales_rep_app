using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.Irm;
using backend.Models.Entities;
using backend.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Implementations;

public class IrmOtherService : IIrmOtherService
{
    private readonly ApplicationDbContext _context;

    public IrmOtherService(ApplicationDbContext context)
    {
        _context = context;
    }

    public static readonly Dictionary<string, List<string>> ModuleOutcomes = new(StringComparer.OrdinalIgnoreCase)
    {
        ["my_leads"] = new() { "Follow-up Required", "No Response", "Call Back" },
        ["follow_up"] = new() { "Follow-up Required", "Other", "No Response", "Call Back", "Ready for KYC" },
        ["kyc"] = new() { "Contacted", "Other", "No Response", "Call Back" },
        ["opportunities"] = new() { "Contacted", "Other", "No Response", "Call Back" },
        ["investor_360"] = new() { "Contacted", "Other", "No Response", "Call Back" }
    };

    public ApiResponse<Dictionary<string, List<string>>> GetCallOutcomes()
    {
        return ApiResponse<Dictionary<string, List<string>>>.SuccessResponse(ModuleOutcomes);
    }

    public static string? NormalizeModule(string? module)
    {
        if (string.IsNullOrWhiteSpace(module)) return null;
        var clean = module.Trim().ToLowerInvariant().Replace("-", "_").Replace(" ", "_");
        if (clean == "myleads" || clean == "leads") return "my_leads";
        if (clean == "followup" || clean == "followups") return "follow_up";
        if (clean == "investor360" || clean == "investors" || clean == "investor") return "investor_360";
        if (clean == "opportunity" || clean == "opps") return "opportunities";
        return clean;
    }

    public class ContactCluster
    {
        public List<CallRecord> Calls { get; } = new();
        public HashSet<string> PhoneKeys { get; } = new(StringComparer.OrdinalIgnoreCase);
        public HashSet<int> CustomerIds { get; } = new();
        public HashSet<int> LeadIds { get; } = new();
        public HashSet<string> NameKeys { get; } = new(StringComparer.OrdinalIgnoreCase);
    }

    public static List<ContactCluster> ClusterCalls(List<CallRecord> calls)
    {
        var n = calls.Count;
        if (n == 0) return new List<ContactCluster>();

        var parent = new int[n];
        for (int i = 0; i < n; i++) parent[i] = i;

        int Find(int i)
        {
            while (i != parent[i])
            {
                parent[i] = parent[parent[i]];
                i = parent[i];
            }
            return i;
        }

        void Union(int i, int j)
        {
            int rootI = Find(i);
            int rootJ = Find(j);
            if (rootI != rootJ) parent[rootI] = rootJ;
        }

        var phoneToIdx = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        var custToIdx = new Dictionary<int, int>();
        var leadToIdx = new Dictionary<int, int>();
        var nameToIdx = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        for (int i = 0; i < n; i++)
        {
            var c = calls[i];
            var cleanPhone = ContactOtherMatcher.NormalizeDigits(c.ContactPhone);
            var custId = (c.CustomerId.HasValue && c.CustomerId.Value > 0) ? c.CustomerId.Value : (int?)null;
            var leadId = (c.LeadId.HasValue && c.LeadId.Value > 0) ? c.LeadId.Value : (int?)null;
            var cleanName = ContactOtherMatcher.NormalizeString(c.ContactName);

            if (!string.IsNullOrEmpty(cleanPhone))
            {
                if (phoneToIdx.TryGetValue(cleanPhone, out var prev)) Union(i, prev);
                else phoneToIdx[cleanPhone] = i;
            }

            if (custId.HasValue)
            {
                if (custToIdx.TryGetValue(custId.Value, out var prev)) Union(i, prev);
                else custToIdx[custId.Value] = i;
            }

            if (leadId.HasValue)
            {
                if (leadToIdx.TryGetValue(leadId.Value, out var prev)) Union(i, prev);
                else leadToIdx[leadId.Value] = i;
            }

            if (string.IsNullOrEmpty(cleanPhone) && !custId.HasValue && !leadId.HasValue && !string.IsNullOrEmpty(cleanName))
            {
                if (nameToIdx.TryGetValue(cleanName, out var prev)) Union(i, prev);
                else nameToIdx[cleanName] = i;
            }
        }

        var clusterMap = new Dictionary<int, ContactCluster>();
        for (int i = 0; i < n; i++)
        {
            int root = Find(i);
            if (!clusterMap.TryGetValue(root, out var cluster))
            {
                cluster = new ContactCluster();
                clusterMap[root] = cluster;
            }
            var c = calls[i];
            cluster.Calls.Add(c);
            var cleanPhone = ContactOtherMatcher.NormalizeDigits(c.ContactPhone);
            if (!string.IsNullOrEmpty(cleanPhone)) cluster.PhoneKeys.Add(cleanPhone);
            if (c.CustomerId.HasValue && c.CustomerId.Value > 0) cluster.CustomerIds.Add(c.CustomerId.Value);
            if (c.LeadId.HasValue && c.LeadId.Value > 0) cluster.LeadIds.Add(c.LeadId.Value);
            var cleanName = ContactOtherMatcher.NormalizeString(c.ContactName);
            if (!string.IsNullOrEmpty(cleanName)) cluster.NameKeys.Add(cleanName);
        }

        return clusterMap.Values.ToList();
    }

    public Task<ContactOtherMatcher> GetOtherMatcherAsync(int companyId, string? module = null, CancellationToken ct = default)
        => GetOtherMatcherAsync(companyId, module, null, ct);

    public async Task<ContactOtherMatcher> GetOtherMatcherAsync(int companyId, string? module, int? irmId, CancellationToken ct = default)
    {
        var matcher = new ContactOtherMatcher();
        var query = _context.CallRecords.AsNoTracking()
            .Where(c => c.CompanyId == companyId);
        if (irmId.HasValue && irmId.Value > 0)
        {
            query = query.Where(c => c.AgentId == irmId.Value);
        }
        var allCalls = await query
            .OrderByDescending(c => c.Timestamp)
            .ToListAsync(ct);

        if (allCalls.Count == 0) return matcher;

        var clusters = ClusterCalls(allCalls);
        var normFilterModule = NormalizeModule(module);

        foreach (var cluster in clusters)
        {
            List<CallRecord> relevantCalls;
            if (normFilterModule != null)
            {
                relevantCalls = cluster.Calls
                    .Where(c => string.Equals(NormalizeModule(c.CallModule), normFilterModule, StringComparison.OrdinalIgnoreCase) || string.IsNullOrEmpty(c.CallModule))
                    .ToList();
            }
            else
            {
                relevantCalls = cluster.Calls;
            }

            if (relevantCalls.Count == 0) continue;

            var latestCall = relevantCalls.OrderByDescending(c => c.Timestamp).First();
            if (string.Equals(latestCall.Disposition?.Trim(), "Other", StringComparison.OrdinalIgnoreCase))
            {
                foreach (var p in cluster.PhoneKeys) matcher.PhoneKeys.Add(p);
                foreach (var cid in cluster.CustomerIds) matcher.CustomerIds.Add(cid);
                foreach (var lid in cluster.LeadIds) matcher.LeadIds.Add(lid);
                foreach (var nm in cluster.NameKeys) matcher.NameKeys.Add(nm);
            }
        }

        return matcher;
    }

    public async Task<ApiResponse<List<IrmOtherRecordDto>>> GetOtherRecordsAsync(
        int companyId,
        int? irmId,
        string? moduleFilter,
        string? search,
        CancellationToken ct = default)
    {
        var allCalls = await _context.CallRecords.AsNoTracking()
            .Include(c => c.Company)
            .Include(c => c.Agent)
            .Where(c => c.CompanyId == companyId)
            .OrderByDescending(c => c.Timestamp)
            .ToListAsync(ct);

        var clusters = ClusterCalls(allCalls);
        var otherRecords = new List<IrmOtherRecordDto>();
        var normFilter = NormalizeModule(moduleFilter);

        foreach (var cluster in clusters)
        {
            var moduleGroups = cluster.Calls
                .GroupBy(c => NormalizeModule(c.CallModule) ?? "investor_360");

            foreach (var grp in moduleGroups)
            {
                var normModule = grp.Key;
                if (normFilter != null && !string.Equals(normModule, normFilter, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                var latestCall = grp.OrderByDescending(c => c.Timestamp).First();

                if (string.Equals(latestCall.Disposition?.Trim(), "Other", StringComparison.OrdinalIgnoreCase))
                {
                    if (irmId.HasValue && irmId.Value > 0 && latestCall.AgentId != irmId.Value)
                    {
                        continue;
                    }

                    var displayName = normModule switch
                    {
                        "my_leads" => "My Leads",
                        "follow_up" => "Follow-up",
                        "kyc" => "KYC",
                        "opportunities" => "Opportunities",
                        "investor_360" => "Investor 360",
                        _ => normModule
                    };

                    var effectiveReason = (latestCall.Reason ?? latestCall.Notes ?? string.Empty).Trim();

                    otherRecords.Add(new IrmOtherRecordDto
                    {
                        CallId = latestCall.Id,
                        CustomerId = latestCall.CustomerId ?? (cluster.CustomerIds.Count > 0 ? cluster.CustomerIds.First() : null),
                        LeadId = latestCall.LeadId ?? (cluster.LeadIds.Count > 0 ? cluster.LeadIds.First() : null),
                        ContactName = latestCall.ContactName,
                        ContactPhone = latestCall.ContactPhone,
                        CallModule = normModule,
                        ModuleDisplayName = displayName,
                        Disposition = "Other",
                        Reason = effectiveReason,
                        AgentId = latestCall.AgentId,
                        AgentName = latestCall.Agent?.Name ?? "IRM Advisor",
                        CompanyId = latestCall.CompanyId,
                        CompanyName = latestCall.Company?.Name ?? "GHL India Ventures",
                        LastCallAt = latestCall.Timestamp,
                        Duration = latestCall.Duration
                    });
                }
            }
        }

        // Enrich contact details from Customer or Lead entities
        var customerIds = otherRecords.Where(r => r.CustomerId.HasValue).Select(r => r.CustomerId!.Value).Distinct().ToList();
        var leadIds = otherRecords.Where(r => r.LeadId.HasValue).Select(r => r.LeadId!.Value).Distinct().ToList();

        if (customerIds.Count > 0)
        {
            var custMap = await _context.Customers.AsNoTracking()
                .Where(c => customerIds.Contains(c.Id))
                .ToDictionaryAsync(c => c.Id, c => new { c.Email, c.Name, c.Phone }, ct);

            foreach (var r in otherRecords.Where(r => r.CustomerId.HasValue))
            {
                if (custMap.TryGetValue(r.CustomerId!.Value, out var c))
                {
                    if (!string.IsNullOrWhiteSpace(c.Email)) r.ContactEmail = c.Email;
                    if (string.IsNullOrWhiteSpace(r.ContactName) && !string.IsNullOrWhiteSpace(c.Name)) r.ContactName = c.Name;
                    if (string.IsNullOrWhiteSpace(r.ContactPhone) && !string.IsNullOrWhiteSpace(c.Phone)) r.ContactPhone = c.Phone;
                }
            }
        }

        if (leadIds.Count > 0)
        {
            var leadMap = await _context.Leads.AsNoTracking()
                .Where(l => leadIds.Contains(l.Id))
                .ToDictionaryAsync(l => l.Id, l => new { l.Email, l.Name, l.Phone }, ct);

            foreach (var r in otherRecords.Where(r => r.LeadId.HasValue))
            {
                if (leadMap.TryGetValue(r.LeadId!.Value, out var l))
                {
                    if (string.IsNullOrWhiteSpace(r.ContactEmail) && !string.IsNullOrWhiteSpace(l.Email)) r.ContactEmail = l.Email;
                    if (string.IsNullOrWhiteSpace(r.ContactName) && !string.IsNullOrWhiteSpace(l.Name)) r.ContactName = l.Name;
                    if (string.IsNullOrWhiteSpace(r.ContactPhone) && !string.IsNullOrWhiteSpace(l.Phone)) r.ContactPhone = l.Phone;
                }
            }
        }

        var agentIds = otherRecords.Select(r => r.AgentId).Where(id => id > 0).Distinct().ToList();
        if (agentIds.Count > 0)
        {
            var agentMap = await _context.Users.AsNoTracking()
                .Where(u => agentIds.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id, u => u.Name, ct);

            foreach (var r in otherRecords)
            {
                if (agentMap.TryGetValue(r.AgentId, out var agentName) && !string.IsNullOrWhiteSpace(agentName))
                {
                    r.AgentName = agentName;
                }
            }
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLowerInvariant();
            otherRecords = otherRecords.Where(r =>
                (r.ContactName != null && r.ContactName.ToLowerInvariant().Contains(s)) ||
                (r.ContactPhone != null && r.ContactPhone.Contains(s)) ||
                (r.ContactEmail != null && r.ContactEmail.ToLowerInvariant().Contains(s)) ||
                (r.Reason != null && r.Reason.ToLowerInvariant().Contains(s)) ||
                (r.ModuleDisplayName != null && r.ModuleDisplayName.ToLowerInvariant().Contains(s))
            ).ToList();
        }

        otherRecords = otherRecords.OrderByDescending(r => r.LastCallAt).ToList();

        return ApiResponse<List<IrmOtherRecordDto>>.SuccessResponse(otherRecords, "Other module records retrieved successfully.");
    }
}
