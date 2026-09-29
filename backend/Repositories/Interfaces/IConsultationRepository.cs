using backend.Models.Entities;

namespace backend.Repositories.Interfaces;

public interface IConsultationRepository
{
    Task<List<Consultation>> GetAllAsync(int companyId, int? consultantId, string? status, DateTime? from, DateTime? to, CancellationToken ct = default);
    Task<Consultation?> GetByIdAsync(int id, int companyId, CancellationToken ct = default);
    Task<Consultation> CreateAsync(Consultation consultation, CancellationToken ct = default);
    Task<Consultation> UpdateAsync(Consultation consultation, CancellationToken ct = default);
    Task DeleteAsync(int id, CancellationToken ct = default);
    Task<List<Consultation>> GetByInvestorIdAsync(int investorId, int companyId, CancellationToken ct = default);
}
