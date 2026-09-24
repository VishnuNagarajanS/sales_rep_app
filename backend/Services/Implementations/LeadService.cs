using backend.Data;
using backend.DTOs.Leads;
using backend.Models.Entities;
using backend.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Implementations;

public sealed class LeadService(ApplicationDbContext context, ICurrentUserService currentUser) : ILeadService
{
    public async Task<IReadOnlyList<LeadDto>> GetAsync(CancellationToken cancellationToken) =>
        await context.Leads.AsNoTracking()
            .Where(x => x.CompanyId == currentUser.CompanyId &&
                (currentUser.RoleCode != "sales_executive" || x.AssignedToUserId == currentUser.UserId))
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => Map(x))
            .ToListAsync(cancellationToken);

    public async Task<LeadDto> CreateAsync(UpsertLeadDto request, CancellationToken cancellationToken)
    {
        var lead = new Lead
        {
            CompanyId = currentUser.CompanyId,
            AssignedToUserId = currentUser.RoleCode == "sales_executive"
                ? currentUser.UserId
                : request.AssignedToUserId,
            Name = request.Name.Trim(),
            Email = request.Email.Trim(),
            Phone = request.Phone.Trim(),
            Status = request.Status.Trim()
        };
        context.Leads.Add(lead);
        await context.SaveChangesAsync(cancellationToken);
        return Map(lead);
    }

    public async Task<LeadDto?> UpdateAsync(int id, UpsertLeadDto request, CancellationToken cancellationToken)
    {
        var lead = await context.Leads.FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == currentUser.CompanyId &&
            (currentUser.RoleCode != "sales_executive" || x.AssignedToUserId == currentUser.UserId), cancellationToken);
        if (lead == null) return null;
        if (currentUser.RoleCode == "sales_executive")
        {
            lead.AssignedToUserId = currentUser.UserId;
        }
        else
        {
            lead.AssignedToUserId = request.AssignedToUserId;
        }
        lead.Name = request.Name.Trim();
        lead.Email = request.Email.Trim();
        lead.Phone = request.Phone.Trim();
        lead.Status = request.Status.Trim();
        lead.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(cancellationToken);
        return Map(lead);
    }

    public async Task<bool> DeleteAsync(int id, CancellationToken cancellationToken)
    {
        var lead = await context.Leads.FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == currentUser.CompanyId &&
            (currentUser.RoleCode != "sales_executive" || x.AssignedToUserId == currentUser.UserId), cancellationToken);
        if (lead == null) return false;
        context.Leads.Remove(lead);
        await context.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static LeadDto Map(Lead x) => new()
    {
        Id = x.Id, CompanyId = x.CompanyId, AssignedToUserId = x.AssignedToUserId,
        Name = x.Name, Email = x.Email, Phone = x.Phone, Status = x.Status,
        CreatedAt = x.CreatedAt, UpdatedAt = x.UpdatedAt
    };
}