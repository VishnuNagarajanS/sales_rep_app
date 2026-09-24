using backend.DTOs.Leads;

namespace backend.Services.Interfaces;

public interface ILeadService
{
    Task<IReadOnlyList<LeadDto>> GetAsync(CancellationToken cancellationToken);
    Task<LeadDto> CreateAsync(UpsertLeadDto request, CancellationToken cancellationToken);
    Task<LeadDto?> UpdateAsync(int id, UpsertLeadDto request, CancellationToken cancellationToken);
    Task<bool> DeleteAsync(int id, CancellationToken cancellationToken);
}