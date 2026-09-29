using backend.DTOs.Common;
using backend.DTOs.Notifications;
using backend.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers.SalesExecutive;

[ApiController, Authorize(Roles = "sales_executive,company_admin,sales_manager,super_admin,irm"), Route("api/sales-executive/notifications")]
public sealed class SalesExecutiveNotificationsController(INotificationService service) : ControllerBase
{
    [HttpGet] public async Task<IActionResult> Get(CancellationToken cancellationToken) => Ok(ApiResponse<IReadOnlyList<NotificationDto>>.SuccessResult(await service.GetAsync(cancellationToken)));
    [HttpPatch("{id:int}/read")] public async Task<IActionResult> Read(int id, CancellationToken cancellationToken) => await service.MarkReadAsync(id, cancellationToken) ? Ok(ApiResponse<object>.SuccessResult(new { }, "Notification marked as read")) : NotFound();
    [HttpPost("read-all")] public async Task<IActionResult> ReadAll(CancellationToken cancellationToken) => Ok(ApiResponse<int>.SuccessResult(await service.MarkAllReadAsync(cancellationToken), "Notifications marked as read"));
}
