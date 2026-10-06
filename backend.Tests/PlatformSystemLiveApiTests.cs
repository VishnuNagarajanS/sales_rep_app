using System;
using System.Security.Claims;
using System.Threading.Tasks;
using backend.Authentication.Interfaces;
using backend.Configuration;
using backend.Controllers.SuperAdmin;
using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.SuperAdmin;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;

namespace backend.Tests;

public class PlatformSystemLiveApiTests
{
    private (PlatformSystemController controller, ApplicationDbContext db) CreateController()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var db = new ApplicationDbContext(options);

        // Seed basic entities for diagnostics checks
        db.Users.Add(new backend.Models.Entities.User
        {
            Id = 1,
            Name = "Super Admin",
            Email = "admin@example.com",
            PasswordHash = "hash",
            RoleId = 1,
            Status = backend.Models.Enums.UserStatus.Active,
            CreatedAt = DateTime.UtcNow
        });
        db.Tenants.Add(new backend.Models.Entities.Tenant
        {
            Id = 1,
            Name = "Primary Tenant",
            Slug = "primary-tenant",
            Status = "Active",
            CreatedAt = DateTime.UtcNow
        });
        db.SaveChanges();

        var currentUserMock = new Mock<ICurrentUserService>();
        currentUserMock.Setup(c => c.UserId).Returns(1);
        currentUserMock.Setup(c => c.Email).Returns("yanosh@ghlindiaventures.com");
        currentUserMock.Setup(c => c.Role).Returns("super_admin");

        var inMemorySettings = new System.Collections.Generic.Dictionary<string, string?>
        {
            ["JwtSettings:SecretKey"] = "NexusSalesSuperSecretSigningKey2026SecureDevKey!#",
            ["JwtSettings:Issuer"] = "NexusSalesApi",
            ["JwtSettings:Audience"] = "NexusSalesClient",
            ["JwtSettings:ExpirationMinutes"] = "60"
        };
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(inMemorySettings)
            .Build();

        var smtpSettings = new SmtpSettings
        {
            Host = "smtp.gmail.com",
            Port = 587,
            EnableSsl = true,
            SenderEmail = "studymail.zero@gmail.com",
            SenderName = "NexusSales Compliance"
        };
        var smtpOptionsMock = new Mock<IOptionsMonitor<SmtpSettings>>();
        smtpOptionsMock.Setup(o => o.CurrentValue).Returns(smtpSettings);

        var hubMock = new Mock<Microsoft.AspNetCore.SignalR.IHubContext<backend.Hubs.PlatformHub, backend.Hubs.IPlatformHubClient>>();
        var controller = new PlatformSystemController(
            db,
            currentUserMock.Object,
            config,
            smtpOptionsMock.Object,
            NullLogger<PlatformSystemController>.Instance,
            hubMock.Object);

        var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, "1"),
            new Claim(ClaimTypes.Role, "super_admin")
        }, "TestAuth"));

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        };

        return (controller, db);
    }

    [Fact]
    public async Task GetDiagnostics_ReturnsRealMetrics()
    {
        var (controller, db) = CreateController();
        var actionResult = await controller.GetSystemDiagnostics();

        var okResult = Assert.IsType<OkObjectResult>(actionResult.Result);
        var res = Assert.IsType<ApiResponse<SystemDiagnosticsDto>>(okResult.Value);

        Assert.True(res.Success);
        Assert.NotNull(res.Data);
        Assert.True(res.Data.TotalUsers > 0, "Total users should be > 0 from real DB");
        Assert.True(res.Data.TotalTenants > 0, "Total tenants should be > 0 from real DB");
        Assert.True(res.Data.MemoryUsedMb > 0, "Memory used should be > 0 from real process");
        Assert.True(res.Data.DatabaseConnected, "Database should be connected");
        Assert.False(string.IsNullOrWhiteSpace(res.Data.ServerHost), "ServerHost should be populated");
        Assert.False(string.IsNullOrWhiteSpace(res.Data.OsDescription), "OsDescription should be populated");
    }

    [Fact]
    public async Task GetHealthChecks_ReturnsComprehensiveChecks()
    {
        var (controller, db) = CreateController();
        var actionResult = await controller.GetHealthChecks();

        var okResult = Assert.IsType<OkObjectResult>(actionResult.Result);
        var res = Assert.IsType<ApiResponse<SystemHealthReportDto>>(okResult.Value);

        Assert.True(res.Success);
        Assert.NotNull(res.Data);
        Assert.Equal(6, res.Data.Checks.Count);

        var dbCheck = res.Data.Checks.Find(c => c.Component == "Database");
        Assert.NotNull(dbCheck);
        Assert.True(dbCheck.Status == "Healthy" || dbCheck.Status == "Degraded");

        var apiCheck = res.Data.Checks.Find(c => c.Component == "API Server");
        Assert.NotNull(apiCheck);
        Assert.Equal("Healthy", apiCheck.Status);

        var authCheck = res.Data.Checks.Find(c => c.Component == "Authentication");
        Assert.NotNull(authCheck);
        Assert.Equal("Healthy", authCheck.Status);
    }

    [Fact]
    public async Task GlobalConfig_GetAndUpdate_PersistsSuccessfully()
    {
        var (controller, db) = CreateController();

        // 1. Get initial
        var getAction = await controller.GetGlobalConfig();
        var getOk = Assert.IsType<OkObjectResult>(getAction.Result);
        var getRes = Assert.IsType<ApiResponse<GlobalConfigDto>>(getOk.Value);
        Assert.True(getRes.Success);
        Assert.NotNull(getRes.Data);

        // 2. Update
        var updateReq = new UpdateGlobalConfigRequestDto
        {
            PlatformName = "NexusSales Enterprise Live",
            SessionTimeoutMinutes = 45,
            MaxUploadSizeMb = 30
        };

        var putAction = await controller.UpdateGlobalConfig(updateReq);
        var putOk = Assert.IsType<OkObjectResult>(putAction.Result);
        var putRes = Assert.IsType<ApiResponse<GlobalConfigDto>>(putOk.Value);

        Assert.True(putRes.Success);
        Assert.Equal("NexusSales Enterprise Live", putRes.Data!.PlatformName);
        Assert.Equal(45, putRes.Data.SessionTimeoutMinutes);
        Assert.Equal(30, putRes.Data.MaxUploadSizeMb);

        // 3. Verify in DB
        var setting = await db.PlatformSettings.FirstOrDefaultAsync(s => s.Key == "global_platform_config");
        Assert.NotNull(setting);
        Assert.Contains("NexusSales Enterprise Live", setting.Value);
    }

    [Fact]
    public async Task ExportPlatformBackup_PersistsLastBackupTimestamp()
    {
        var (controller, db) = CreateController();
        var actionResult = await controller.ExportPlatformBackup();

        var okResult = Assert.IsType<OkObjectResult>(actionResult.Result);
        var res = Assert.IsType<ApiResponse<object>>(okResult.Value);
        Assert.True(res.Success);

        var backupSetting = await db.PlatformSettings.FirstOrDefaultAsync(s => s.Key == "last_platform_backup_at");
        Assert.NotNull(backupSetting);
        Assert.False(string.IsNullOrWhiteSpace(backupSetting.Value));
    }

    [Fact]
    public async Task BroadcastAnnouncement_ActivateWhenAnotherGlobalActive_RejectsWith400()
    {
        var (controller, db) = CreateController();

        // 1. Create first announcement as active
        var create1 = await controller.CreateAnnouncement(new CreateAnnouncementRequestDto
        {
            Title = "First Broadcast",
            Message = "System notice 1",
            Priority = "info",
            TargetAudience = "all",
            IsActive = true
        });
        var ok1 = Assert.IsType<CreatedAtActionResult>(create1.Result);
        var res1 = Assert.IsType<ApiResponse<AnnouncementResponseDto>>(ok1.Value);
        Assert.True(res1.Success);
        Assert.True(res1.Data!.IsActive);

        // 2. Attempt to create second global announcement as active -> MUST reject with 400
        var create2 = await controller.CreateAnnouncement(new CreateAnnouncementRequestDto
        {
            Title = "Second Broadcast",
            Message = "System notice 2",
            Priority = "warning",
            TargetAudience = "all",
            IsActive = true
        });
        var badReq2 = Assert.IsType<BadRequestObjectResult>(create2.Result);
        var err2 = Assert.IsType<ApiResponse<AnnouncementResponseDto>>(badReq2.Value);
        Assert.False(err2.Success);
        Assert.Equal("Another global broadcast is already active. Deactivate the current broadcast before activating this one.", err2.Message);

        // 3. Creating second announcement as INACTIVE -> MUST succeed
        var create2Inactive = await controller.CreateAnnouncement(new CreateAnnouncementRequestDto
        {
            Title = "Second Broadcast Inactive",
            Message = "System notice 2 inactive",
            Priority = "warning",
            TargetAudience = "all",
            IsActive = false
        });
        var ok2Inactive = Assert.IsType<CreatedAtActionResult>(create2Inactive.Result);
        var res2Inactive = Assert.IsType<ApiResponse<AnnouncementResponseDto>>(ok2Inactive.Value);
        Assert.True(res2Inactive.Success);
        Assert.False(res2Inactive.Data!.IsActive);
        int secondId = int.Parse(res2Inactive.Data.Id);

        // 4. Attempt to toggle second announcement to ACTIVE -> MUST reject with 400
        var toggleAttempt = await controller.ToggleAnnouncementStatus(secondId, new AnnouncementStatusUpdateDto { IsActive = true });
        var badToggle = Assert.IsType<BadRequestObjectResult>(toggleAttempt.Result);
        var errToggle = Assert.IsType<ApiResponse<AnnouncementResponseDto>>(badToggle.Value);
        Assert.False(errToggle.Success);
        Assert.Equal("Another global broadcast is already active. Deactivate the current broadcast before activating this one.", errToggle.Message);

        // 5. Deactivate first broadcast -> MUST succeed
        int firstId = int.Parse(res1.Data.Id);
        var deact1 = await controller.ToggleAnnouncementStatus(firstId, new AnnouncementStatusUpdateDto { IsActive = false });
        var okDeact = Assert.IsType<OkObjectResult>(deact1.Result);
        Assert.True(Assert.IsType<ApiResponse<AnnouncementResponseDto>>(okDeact.Value).Success);

        // 6. Now toggle second announcement to ACTIVE -> MUST succeed!
        var toggleSuccess = await controller.ToggleAnnouncementStatus(secondId, new AnnouncementStatusUpdateDto { IsActive = true });
        var okToggle = Assert.IsType<OkObjectResult>(toggleSuccess.Result);
        var resToggle = Assert.IsType<ApiResponse<AnnouncementResponseDto>>(okToggle.Value);
        Assert.True(resToggle.Success);
        Assert.True(resToggle.Data!.IsActive);
    }
}
