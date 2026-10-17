using backend.Data;
using backend.Models.Entities;
using backend.Models.Enums;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Implementations;

/// <summary>
/// When a lead becomes "Interested" it stays ONE row in `leads` (status = Interested, agent id changes
/// later when it is assigned to an IRM). Customer 360 reads it from `leads`, so NO row is copied to
/// `customers`. The only DB side effect is that its open sales follow-ups leave the `followups` table.
/// Every code path that sets Lead.Status = "Interested" must call RemoveSalesFollowupsAsync.
/// The caller's SaveChangesAsync commits the status change and the deletes together.
/// </summary>
public static class InterestedLeadConversion
{
    /// <summary>Delete every open sales follow-up of this lead (Pending, Rescheduled and the
    /// "Cancelled" leftovers the old code wrote). Completed rows are kept as history.
    /// IRM follow-ups are kept: IRMs keep working Interested leads.</summary>
    public static async Task RemoveSalesFollowupsAsync(ApplicationDbContext context, Lead lead, CancellationToken ct)
    {
        var leadIdStr = lead.Id.ToString();
        var phoneDigits = string.Concat((lead.Phone ?? "").Where(char.IsDigit));
        var last10 = phoneDigits.Length >= 10 ? phoneDigits.Substring(phoneDigits.Length - 10) : phoneDigits;

        var candidates = await context.Followups
            .Where(f => f.CompanyId == lead.CompanyId &&
                        f.Status != FollowupStatus.Completed &&
                        f.AssignedToRole != "irm")
            .ToListAsync(ct);

        var rows = candidates
            .Where(f => {
                var cId = System.Text.RegularExpressions.Regex.Replace(f.ContactId ?? "", @"\D", "");
                if (!string.IsNullOrEmpty(cId) && cId == leadIdStr) return true;
                if (!string.IsNullOrEmpty(last10) && !string.IsNullOrEmpty(f.ContactPhone))
                {
                    var fDigits = string.Concat(f.ContactPhone.Where(char.IsDigit));
                    if (fDigits.EndsWith(last10)) return true;
                }
                return false;
            })
            .ToList();

        if (rows.Count > 0) context.Followups.RemoveRange(rows);
    }
}
