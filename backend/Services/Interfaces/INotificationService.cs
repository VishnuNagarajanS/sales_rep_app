using backend.DTOs.Notifications;

namespace backend.Services.Interfaces;

public interface INotificationService
{
    Task<IReadOnlyList<NotificationDto>> GetAsync(CancellationToken cancellationToken);
    Task<bool> MarkReadAsync(int id, CancellationToken cancellationToken);
    Task<int> MarkAllReadAsync(CancellationToken cancellationToken);
}
