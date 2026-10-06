using backend.Data;
using backend.Models.Entities;
using backend.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace backend.Repositories.Implementations;

public class IrmPipelineRepository : IIrmPipelineRepository
{
    private readonly ApplicationDbContext _db;

    public IrmPipelineRepository(ApplicationDbContext db) => _db = db;

    public Task<List<IrmPipelineCard>> GetAllAsync(int companyId, int? irmId, CancellationToken ct = default)
        => Task.FromResult(new List<IrmPipelineCard>());

    public Task<IrmPipelineCard?> GetByIdAsync(int id, int companyId, CancellationToken ct = default)
        => Task.FromResult<IrmPipelineCard?>(null);

    public Task<IrmPipelineCard?> GetByInvestorIdAsync(int investorId, int companyId, CancellationToken ct = default)
        => Task.FromResult<IrmPipelineCard?>(null);

    public Task<IrmPipelineCard> CreateAsync(IrmPipelineCard card, CancellationToken ct = default)
        => Task.FromResult(card);

    public Task<IrmPipelineCard> UpdateAsync(IrmPipelineCard card, CancellationToken ct = default)
        => Task.FromResult(card);
}
