using backend.Data;
using backend.Models.Entities;
using backend.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace backend.Repositories.Implementations;

public class InvestorCallRepository : IInvestorCallRepository
{
    private readonly ApplicationDbContext _db;

    public InvestorCallRepository(ApplicationDbContext db) => _db = db;

    public Task<List<InvestorCall>> GetAllAsync(int companyId, int? irmId, CancellationToken ct = default)
        => Task.FromResult(new List<InvestorCall>());

    public Task<InvestorCall?> GetByIdAsync(int id, CancellationToken ct = default)
        => Task.FromResult<InvestorCall?>(null);

    public Task<InvestorCall> CreateAsync(InvestorCall call, CancellationToken ct = default)
        => Task.FromResult(call);

    public Task<List<InvestorCall>> GetByInvestorIdAsync(int investorId, int companyId, CancellationToken ct = default)
        => Task.FromResult(new List<InvestorCall>());
}
