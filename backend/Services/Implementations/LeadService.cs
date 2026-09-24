using backend.Data;
using backend.DTOs.Common;
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
            Location = request.Location?.Trim(),
            Source = request.Source?.Trim(),
            Notes = request.Notes?.Trim(),
            InvestmentCapacity = request.InvestmentCapacity?.Trim(),
            AssetClass = request.AssetClass?.Trim(),
            PreferredAssetClass = request.PreferredAssetClass?.Trim(),
            Horizon = request.Horizon?.Trim(),
            Status = request.Status.Trim()
        };
        context.Leads.Add(lead);
        await context.SaveChangesAsync(cancellationToken);
        return Map(lead);
    }

    public async Task<ApiResponse<PagedResult<LeadResponseDto>>> GetActiveLeadsAsync(LeadFilterDto filter, CancellationToken ct)
    {
        var page = Math.Max(1, filter.Page);
        var pageSize = Math.Clamp(filter.PageSize, 1, 100);
        var query = context.Leads.AsNoTracking().Where(x => x.CompanyId == currentUser.CompanyId && (currentUser.RoleCode != "sales_executive" || x.AssignedToUserId == currentUser.UserId));
        if (!string.IsNullOrWhiteSpace(filter.Status)) query = query.Where(x => x.Status == filter.Status);
        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var s = filter.Search.Trim();
            query = query.Where(x => x.Name.Contains(s) || x.Email.Contains(s) || x.Phone.Contains(s));
        }
        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(x => x.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize).Select(x => MapLeadResponse(x)).ToListAsync(ct);
        return ApiResponse<PagedResult<LeadResponseDto>>.SuccessResult(PagedResult<LeadResponseDto>.Create(items, total, page, pageSize), "Leads retrieved successfully.");
    }

    public async Task<ApiResponse<LeadResponseDto>> GetLeadByIdAsync(int id, CancellationToken ct)
    {
        var lead = await context.Leads.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == currentUser.CompanyId && (currentUser.RoleCode != "sales_executive" || x.AssignedToUserId == currentUser.UserId), ct);
        return lead == null ? ApiResponse<LeadResponseDto>.FailureResult("Lead not found.") : ApiResponse<LeadResponseDto>.SuccessResult(MapLeadResponse(lead));
    }

    public async Task<ApiResponse<LeadResponseDto>> CreateLeadAsync(CreateLeadDto dto, CancellationToken ct)
    {
        var lead = new Lead
        {
            CompanyId = currentUser.CompanyId,
            AssignedToUserId = currentUser.RoleCode == "sales_executive" ? currentUser.UserId : dto.AssignedToUserId,
            Name = dto.Name.Trim(),
            Email = dto.Email.Trim(),
            Phone = dto.Phone.Trim(),
            Location = dto.Location?.Trim(),
            Source = dto.Source?.Trim(),
            Notes = dto.Notes?.Trim(),
            InvestmentCapacity = dto.InvestmentCapacity?.Trim(),
            AssetClass = dto.AssetClass?.Trim(),
            PreferredAssetClass = dto.PreferredAssetClass?.Trim(),
            Horizon = dto.Horizon?.Trim(),
            Status = dto.Status.Trim(),
            CreatedAt = DateTime.UtcNow
        };
        context.Leads.Add(lead);
        await context.SaveChangesAsync(ct);
        return ApiResponse<LeadResponseDto>.SuccessResult(MapLeadResponse(lead), "Lead created successfully.");
    }

    public async Task<ApiResponse<LeadResponseDto>> UpdateLeadAsync(int id, UpdateLeadDto dto, CancellationToken ct)
    {
        var lead = await context.Leads.FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == currentUser.CompanyId && (currentUser.RoleCode != "sales_executive" || x.AssignedToUserId == currentUser.UserId), ct);
        if (lead == null) return ApiResponse<LeadResponseDto>.FailureResult("Lead not found.");
        if (currentUser.RoleCode == "sales_executive") lead.AssignedToUserId = currentUser.UserId;
        else lead.AssignedToUserId = dto.AssignedToUserId;
        lead.Name = dto.Name.Trim();
        lead.Email = dto.Email.Trim();
        lead.Phone = dto.Phone.Trim();
        lead.Location = dto.Location?.Trim();
        lead.Source = dto.Source?.Trim();
        lead.Notes = dto.Notes?.Trim();
        lead.InvestmentCapacity = dto.InvestmentCapacity?.Trim();
        lead.AssetClass = dto.AssetClass?.Trim();
        lead.PreferredAssetClass = dto.PreferredAssetClass?.Trim();
        lead.Horizon = dto.Horizon?.Trim();
        lead.Status = dto.Status.Trim();
        lead.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(ct);
        return ApiResponse<LeadResponseDto>.SuccessResult(MapLeadResponse(lead), "Lead updated successfully.");
    }

    public async Task<ApiResponse<object>> ConvertLeadAsync(int id, ConvertLeadDto dto, CancellationToken ct)
    {
        var lead = await context.Leads.FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == currentUser.CompanyId && (currentUser.RoleCode != "sales_executive" || x.AssignedToUserId == currentUser.UserId), ct);
        if (lead == null) return ApiResponse<object>.FailureResult("Lead not found.");
        lead.Status = "Converted";
        lead.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(ct);
        return ApiResponse<object>.SuccessResult(new { id = lead.Id, status = lead.Status }, "Lead converted successfully.");
    }

    public async Task<ApiResponse<PagedResult<LeadResponseDto>>> GetNotInterestedLeadsAsync(int page, int pageSize, CancellationToken ct)
    {
        return await GetStatusLeadsAsync(page, pageSize, "Not Interested", ct);
    }

    public async Task<ApiResponse<PagedResult<LeadResponseDto>>> GetJunkLeadsAsync(int page, int pageSize, CancellationToken ct)
    {
        return await GetStatusLeadsAsync(page, pageSize, "Junk", ct);
    }

    public async Task<ApiResponse<LeadResponseDto>> ReengageLeadAsync(int id, CancellationToken ct)
    {
        var lead = await context.Leads.FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == currentUser.CompanyId && (currentUser.RoleCode != "sales_executive" || x.AssignedToUserId == currentUser.UserId), ct);
        if (lead == null) return ApiResponse<LeadResponseDto>.FailureResult("Lead not found.");
        lead.Status = "Contacted";
        lead.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(ct);
        return ApiResponse<LeadResponseDto>.SuccessResult(MapLeadResponse(lead), "Lead re-engaged successfully.");
    }

    private async Task<ApiResponse<PagedResult<LeadResponseDto>>> GetStatusLeadsAsync(int page, int pageSize, string status, CancellationToken ct)
    {
        var requestedPage = Math.Max(1, page);
        var requestedPageSize = Math.Clamp(pageSize, 1, 100);
        var query = context.Leads.AsNoTracking().Where(x => x.CompanyId == currentUser.CompanyId && x.Status == status && (currentUser.RoleCode != "sales_executive" || x.AssignedToUserId == currentUser.UserId));
        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(x => x.CreatedAt).Skip((requestedPage - 1) * requestedPageSize).Take(requestedPageSize).Select(x => MapLeadResponse(x)).ToListAsync(ct);
        return ApiResponse<PagedResult<LeadResponseDto>>.SuccessResult(PagedResult<LeadResponseDto>.Create(items, total, requestedPage, requestedPageSize), "Leads retrieved successfully.");
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
        lead.Location = request.Location?.Trim();
        lead.Source = request.Source?.Trim();
        lead.Notes = request.Notes?.Trim();
        lead.InvestmentCapacity = request.InvestmentCapacity?.Trim();
        lead.AssetClass = request.AssetClass?.Trim();
        lead.PreferredAssetClass = request.PreferredAssetClass?.Trim();
        lead.Horizon = request.Horizon?.Trim();
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
        Location = x.Location, Source = x.Source, Notes = x.Notes,
        InvestmentCapacity = x.InvestmentCapacity, AssetClass = x.AssetClass,
        PreferredAssetClass = x.PreferredAssetClass, Horizon = x.Horizon,
        CreatedAt = x.CreatedAt, UpdatedAt = x.UpdatedAt
    };

    private static LeadResponseDto MapLeadResponse(Lead x) => new()
    {
        Id = x.Id,
        CompanyId = x.CompanyId,
        AssignedToUserId = x.AssignedToUserId,
        Name = x.Name,
        Email = x.Email,
        Phone = x.Phone,
        Location = x.Location,
        Source = x.Source,
        Notes = x.Notes,
        InvestmentCapacity = x.InvestmentCapacity,
        AssetClass = x.AssetClass,
        PreferredAssetClass = x.PreferredAssetClass,
        Horizon = x.Horizon,
        Status = x.Status,
        CreatedAt = x.CreatedAt,
        UpdatedAt = x.UpdatedAt
    };
}