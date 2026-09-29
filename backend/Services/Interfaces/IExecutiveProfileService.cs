using backend.DTOs.Profile;

namespace backend.Services.Interfaces;

public interface IExecutiveProfileService
{
    Task<ExecutiveProfileDto?> GetAsync(CancellationToken cancellationToken);
    Task<ExecutiveProfileDto?> UpdateAsync(UpdateProfileDto request, CancellationToken cancellationToken);
}
