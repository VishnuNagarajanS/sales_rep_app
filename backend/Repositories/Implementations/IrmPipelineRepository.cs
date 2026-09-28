using backend.Data;
using backend.Models.Entities;
using backend.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace backend.Repositories.Implementations;

public class IrmPipelineRepository : IIrmPipelineRepository
{
    private readonly ApplicationDbContext _db;

    public IrmPipelineRepository(ApplicationDbContext db) => _db = db;

    public async Task<List<IrmPipelineCard>> GetAllAsync(int companyId, int? irmId, CancellationToken ct = default)
    {
        var query = _db.IrmPipelineCards.Where(c => c.CompanyId == companyId);
        if (irmId.HasValue) query = query.Where(c => c.AssignedIrmId == irmId);
        return await query.OrderByDescending(c => c.StageEnteredAt).ToListAsync(ct);
    }

    public async Task<IrmPipelineCard?> GetByIdAsync(int id, int companyId, CancellationToken ct = default)
        => await _db.IrmPipelineCards.FirstOrDefaultAsync(c => c.Id == id && c.CompanyId == companyId, ct);

    public async Task<IrmPipelineCard?> GetByInvestorIdAsync(int investorId, int companyId, CancellationToken ct = default)
        => await _db.IrmPipelineCards.FirstOrDefaultAsync(c => c.InvestorId == investorId && c.CompanyId == companyId, ct);

    public async Task<IrmPipelineCard> CreateAsync(IrmPipelineCard card, CancellationToken ct = default)
    {
        _db.IrmPipelineCards.Add(card);
        await _db.SaveChangesAsync(ct);
        return card;
    }

    public async Task<IrmPipelineCard> UpdateAsync(IrmPipelineCard card, CancellationToken ct = default)
    {
        card.UpdatedAt = DateTime.UtcNow;
        _db.IrmPipelineCards.Update(card);
        await _db.SaveChangesAsync(ct);
        return card;
    }
}
