using backend.Authentication.Interfaces;
using backend.Data;
using backend.DTOs.Notifications;
using backend.Models.Entities;
using backend.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace backend.Services.Implementations;

public sealed class NotificationService(ApplicationDbContext context, ICurrentUserService currentUser) : INotificationService
{
    public async Task<IReadOnlyList<NotificationDto>> GetAsync(CancellationToken cancellationToken) => await context.Set<Notification>().AsNoTracking().Where(x => x.CompanyId == currentUser.CompanyId && x.UserId == currentUser.UserId).OrderByDescending(x => x.CreatedAt).Take(50).Select(x => new NotificationDto { Id = x.Id, Title = x.Title, Message = x.Message, Type = x.Type, IsRead = x.IsRead, CreatedAt = x.CreatedAt }).ToListAsync(cancellationToken);
    public async Task<bool> MarkReadAsync(int id, CancellationToken cancellationToken) { var item = await context.Set<Notification>().FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == currentUser.CompanyId && x.UserId == currentUser.UserId, cancellationToken); if (item == null) return false; item.IsRead = true; await context.SaveChangesAsync(cancellationToken); return true; }
    public async Task<int> MarkAllReadAsync(CancellationToken cancellationToken) { var items = await context.Set<Notification>().Where(x => x.CompanyId == currentUser.CompanyId && x.UserId == currentUser.UserId && !x.IsRead).ToListAsync(cancellationToken); items.ForEach(x => x.IsRead = true); await context.SaveChangesAsync(cancellationToken); return items.Count; }
}
