using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace backend.Hubs;

public interface IPlatformHubClient
{
    Task UserSuspended(int userId, string email, string reason);
    Task UserActivated(int userId, string email);
    Task TenantSuspended(int tenantId, string reason);
    Task TenantActivated(int tenantId);
    Task MaintenanceModeToggled(bool enabled, string message);
    Task AnnouncementBroadcast(object announcement);
    Task SessionRevoked(string tokenId, int userId);
    Task SecurityAlert(string title, string severity, string message);
    Task PlatformDataUpdated(string entityType, string action);
}

[Authorize]
public class PlatformHub : Hub<IPlatformHubClient>
{
    private readonly ILogger<PlatformHub> _logger;

    public PlatformHub(ILogger<PlatformHub> logger)
    {
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        var user = Context.User;
        var userIdStr = user?.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                        ?? user?.FindFirst("userId")?.Value 
                        ?? user?.FindFirst("sub")?.Value;

        var role = user?.FindFirst(ClaimTypes.Role)?.Value?.ToLowerInvariant();
        var companyIdStr = user?.FindFirst("company_id")?.Value 
                           ?? user?.FindFirst("companyId")?.Value;

        if (!string.IsNullOrEmpty(userIdStr))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user_{userIdStr}");
        }

        if (!string.IsNullOrEmpty(role))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"role_{role}");
            if (role == "super_admin")
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, "super_admin");
            }
        }

        if (!string.IsNullOrEmpty(companyIdStr))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"tenant_{companyIdStr}");
        }

        _logger.LogInformation("SignalR Client connected: {ConnectionId}, User: {UserId}, Role: {Role}, Tenant: {TenantId}",
            Context.ConnectionId, userIdStr, role, companyIdStr);

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation("SignalR Client disconnected: {ConnectionId}", Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }
}
