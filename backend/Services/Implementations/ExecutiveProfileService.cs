using backend.Authentication.Interfaces;
using backend.Data;
using backend.DTOs.Profile;
using backend.Models.Entities;
using backend.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Implementations;

public sealed class ExecutiveProfileService(ApplicationDbContext context, ICurrentUserService currentUser) : IExecutiveProfileService
{
    public async Task<ExecutiveProfileDto?> GetAsync(CancellationToken cancellationToken) => await Load(cancellationToken);

    public async Task<ExecutiveProfileDto?> UpdateAsync(UpdateProfileDto request, CancellationToken cancellationToken)
    {
        var user = await context.Users.FirstOrDefaultAsync(x => x.Id == currentUser.UserId && x.CompanyId == currentUser.CompanyId, cancellationToken);
        if (user == null) return null;
        var profile = await context.Set<ExecutiveProfile>().FirstOrDefaultAsync(x => x.UserId == currentUser.UserId && x.CompanyId == currentUser.CompanyId, cancellationToken);
        if (profile == null) { profile = new ExecutiveProfile { UserId = user.Id, CompanyId = user.CompanyId!.Value }; context.Set<ExecutiveProfile>().Add(profile); }
        if (request.Name != null) user.Name = request.Name; if (request.Phone != null) user.Phone = request.Phone;
        profile.Designation = request.Designation ?? profile.Designation; profile.WorkingHours = request.WorkingHours ?? profile.WorkingHours; if (request.MaxActiveLeads.HasValue) profile.MaxActiveLeads = request.MaxActiveLeads.Value;
        if (request.Skills != null) profile.Skills = request.Skills; if (request.Languages != null) profile.Languages = request.Languages; if (request.Specializations != null) profile.Specializations = request.Specializations; if (request.AutoAnswerCalls.HasValue) profile.AutoAnswerCalls = request.AutoAnswerCalls.Value; if (request.CallRecordingEnabled.HasValue) profile.CallRecordingEnabled = request.CallRecordingEnabled.Value;
        profile.UpdatedAt = DateTime.UtcNow; await context.SaveChangesAsync(cancellationToken); return await Load(cancellationToken);
    }

    private async Task<ExecutiveProfileDto?> Load(CancellationToken cancellationToken)
    {
        var user = await context.Users.AsNoTracking().Include(x => x.Role).FirstOrDefaultAsync(x => x.Id == currentUser.UserId && x.CompanyId == currentUser.CompanyId, cancellationToken); if (user == null) return null;
        var profile = await context.Set<ExecutiveProfile>().AsNoTracking().FirstOrDefaultAsync(x => x.UserId == currentUser.UserId && x.CompanyId == currentUser.CompanyId, cancellationToken);
        return new ExecutiveProfileDto { UserId = user.Id, Name = user.Name, Email = user.Email, Phone = user.Phone, EmployeeId = profile?.EmployeeId, Designation = profile?.Designation, WorkingHours = profile?.WorkingHours, MaxActiveLeads = profile?.MaxActiveLeads ?? 50, Skills = profile?.Skills ?? new(), Languages = profile?.Languages ?? new(), Specializations = profile?.Specializations ?? new(), AutoAnswerCalls = profile?.AutoAnswerCalls ?? false, CallRecordingEnabled = profile?.CallRecordingEnabled ?? true };
    }
}
