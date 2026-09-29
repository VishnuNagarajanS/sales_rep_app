using backend.Data;
using backend.Models.Entities;
using backend.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace backend.Repositories.Implementations;

public class ConsultationRepository : IConsultationRepository
{
    private readonly ApplicationDbContext _db;

    public ConsultationRepository(ApplicationDbContext db) => _db = db;

    public async Task<List<Consultation>> GetAllAsync(int companyId, int? consultantId, string? status, DateTime? from, DateTime? to, CancellationToken ct = default)
    {
        var query = _db.Consultations.Where(c => c.CompanyId == companyId);
        if (consultantId.HasValue) query = query.Where(c => c.ConsultantId == consultantId);
        if (!string.IsNullOrEmpty(status)) query = query.Where(c => c.Status.ToString() == status);
        if (from.HasValue) query = query.Where(c => c.ScheduledAt >= from);
        if (to.HasValue) query = query.Where(c => c.ScheduledAt <= to);
        return await query.OrderByDescending(c => c.ScheduledAt).ToListAsync(ct);
    }

    public async Task<Consultation?> GetByIdAsync(int id, int companyId, CancellationToken ct = default)
        => await _db.Consultations.FirstOrDefaultAsync(c => c.Id == id && c.CompanyId == companyId, ct);

    public async Task<Consultation> CreateAsync(Consultation consultation, CancellationToken ct = default)
    {
        _db.Consultations.Add(consultation);
        await _db.SaveChangesAsync(ct);
        return consultation;
    }

    public async Task<Consultation> UpdateAsync(Consultation consultation, CancellationToken ct = default)
    {
        consultation.UpdatedAt = DateTime.UtcNow;
        _db.Consultations.Update(consultation);
        await _db.SaveChangesAsync(ct);
        return consultation;
    }

    public async Task DeleteAsync(int id, CancellationToken ct = default)
    {
        var c = await _db.Consultations.FindAsync(new object[] { id }, ct);
        if (c != null) { _db.Consultations.Remove(c); await _db.SaveChangesAsync(ct); }
    }

    public async Task<List<Consultation>> GetByInvestorIdAsync(int investorId, int companyId, CancellationToken ct = default)
        => await _db.Consultations
            .Where(c => c.InvestorId == investorId && c.CompanyId == companyId)
            .OrderByDescending(c => c.ScheduledAt).ToListAsync(ct);
}
