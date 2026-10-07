using System;
using System.Threading.Tasks;
using backend.Authentication.Interfaces;
using backend.Controllers.SuperAdmin;
using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.SuperAdmin;
using backend.Hubs;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Moq;
using Xunit;

namespace backend.Tests;

public class PlatformMetricsTests
{
    [Fact]
    public async Task GetPlatformMetrics_InMemory_ReturnsSuccess()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        using var db = new ApplicationDbContext(options);
        db.Database.EnsureCreated();

        var currentUserMock = new Mock<ICurrentUserService>();
        currentUserMock.Setup(c => c.UserId).Returns(1);
        currentUserMock.Setup(c => c.Email).Returns("yanosh@ghlindiaventures.com");
        currentUserMock.Setup(c => c.Role).Returns("super_admin");

        var hubMock = new Mock<IHubContext<PlatformHub, IPlatformHubClient>>();

        var controller = new PlatformUsersController(db, currentUserMock.Object, hubMock.Object);

        var result = await controller.GetPlatformMetrics("Asia/Calcutta");
        Assert.NotNull(result);
        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<ApiResponse<PlatformMetricsDto>>(ok.Value);
        Assert.True(response.Success);
        Assert.NotNull(response.Data);
    }

    [Fact]
    public async Task GetPlatformMetrics_RealDb_IfConfigured_ReturnsSuccess()
    {
        var config = new ConfigurationBuilder()
            .AddUserSecrets("d8f4d21c-064e-4905-9940-d46d99418ec6")
            .Build();

        var conn = config.GetConnectionString("DefaultConnection") 
            ?? config["ConnectionStrings:DefaultConnection"]
            ?? config["ConnectionString:DefaultConnection"];

        if (string.IsNullOrWhiteSpace(conn))
        {
            return;
        }

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(conn)
            .Options;

        using var db = new ApplicationDbContext(options);

        var currentUserMock = new Mock<ICurrentUserService>();
        currentUserMock.Setup(c => c.UserId).Returns(1);
        currentUserMock.Setup(c => c.Email).Returns("yanosh@ghlindiaventures.com");
        currentUserMock.Setup(c => c.Role).Returns("super_admin");

        var hubMock = new Mock<IHubContext<PlatformHub, IPlatformHubClient>>();

        var controller = new PlatformUsersController(db, currentUserMock.Object, hubMock.Object);

        var result = await controller.GetPlatformMetrics("Asia/Calcutta");
        Assert.NotNull(result);
        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<ApiResponse<PlatformMetricsDto>>(ok.Value);
        Assert.True(response.Success);
        Assert.NotNull(response.Data);
    }
}
