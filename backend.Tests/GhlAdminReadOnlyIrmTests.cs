using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using backend.Authentication.Interfaces;
using backend.Controllers.GhlAdmin;
using backend.Controllers.Irm;
using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.GhlDeals;
using backend.DTOs.GhlInvestors;
using backend.DTOs.GhlOpportunities;
using backend.DTOs.Irm;
using backend.Models.Entities;
using backend.Services.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace backend.Tests;

public class GhlAdminReadOnlyIrmTests
{
    private ApplicationDbContext CreateInMemoryDbContext(string dbName)
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: dbName)
            .Options;
        return new ApplicationDbContext(options);
    }

    private ClaimsPrincipal CreateClaimsPrincipal(int userId, int companyId, string role)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new("userId", userId.ToString()),
            new("company_id", companyId.ToString()),
            new(ClaimTypes.Role, role),
            new("role", role),
            new(ClaimTypes.Email, $"{role}@ghl.com"),
            new(ClaimTypes.Name, $"{role} User")
        };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        return new ClaimsPrincipal(identity);
    }

    private void SetControllerContext(ControllerBase controller, ClaimsPrincipal principal)
    {
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = principal }
        };
    }

    [Theory]
    [InlineData("company_admin")]
    [InlineData("admin")]
    [InlineData("super_admin")]
    [InlineData("ghl_admin")]
    public async Task IrmPipeline_MoveStage_Returns403_ForGhlAdmin(string role)
    {
        var mockService = new Mock<IIrmPipelineService>();
        var controller = new IrmPipelineController(mockService.Object);
        SetControllerContext(controller, CreateClaimsPrincipal(1, 1, role));

        var result = await controller.MoveStage(10, new MoveIrmStageDto { TargetStageId = "investment_opportunity" }, CancellationToken.None);

        var objResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, objResult.StatusCode);
        mockService.Verify(s => s.MoveStageAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<MoveIrmStageDto>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task IrmPipeline_LogActivity_Returns403_ForGhlAdmin()
    {
        var mockService = new Mock<IIrmPipelineService>();
        var controller = new IrmPipelineController(mockService.Object);
        SetControllerContext(controller, CreateClaimsPrincipal(1, 1, "company_admin"));

        var result = await controller.LogActivity(10, new LogIrmActivityDto { Type = "note", Details = "Test note" }, CancellationToken.None);

        var objResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, objResult.StatusCode);
    }

    [Fact]
    public async Task IrmFollowups_Create_Complete_Reschedule_Returns403_ForGhlAdmin()
    {
        var mockService = new Mock<IIrmFollowupService>();
        var controller = new IrmFollowupsController(mockService.Object);
        SetControllerContext(controller, CreateClaimsPrincipal(1, 1, "company_admin"));

        var createResult = await controller.Create(new CreateFollowupDto { InvestorId = 5, ScheduledAt = DateTime.UtcNow.AddDays(1) }, CancellationToken.None);
        var createObj = Assert.IsType<ObjectResult>(createResult);
        Assert.Equal(StatusCodes.Status403Forbidden, createObj.StatusCode);

        var completeResult = await controller.Complete(10, new CompleteFollowupDto { OutcomeNotes = "Done" }, CancellationToken.None);
        var completeObj = Assert.IsType<ObjectResult>(completeResult);
        Assert.Equal(StatusCodes.Status403Forbidden, completeObj.StatusCode);

        var reschedResult = await controller.Reschedule(10, new RescheduleFollowupDto { NewScheduledAt = DateTime.UtcNow.AddDays(2) }, CancellationToken.None);
        var reschedObj = Assert.IsType<ObjectResult>(reschedResult);
        Assert.Equal(StatusCodes.Status403Forbidden, reschedObj.StatusCode);
    }

    [Fact]
    public async Task IrmInvestors_Create_Update_Delete_Returns403_ForGhlAdmin()
    {
        var mockService = new Mock<IInvestorService>();
        var controller = new IrmInvestorsController(mockService.Object);
        SetControllerContext(controller, CreateClaimsPrincipal(1, 1, "admin"));

        var createResult = await controller.Create(new CreateInvestorDto { Name = "Jane Doe" }, CancellationToken.None);
        var createObj = Assert.IsType<ObjectResult>(createResult);
        Assert.Equal(StatusCodes.Status403Forbidden, createObj.StatusCode);

        var updateResult = await controller.Update(10, new UpdateInvestorDto { Name = "Jane Updated" }, CancellationToken.None);
        var updateObj = Assert.IsType<ObjectResult>(updateResult);
        Assert.Equal(StatusCodes.Status403Forbidden, updateObj.StatusCode);

        var deleteResult = await controller.Delete(10, CancellationToken.None);
        var deleteObj = Assert.IsType<ObjectResult>(deleteResult);
        Assert.Equal(StatusCodes.Status403Forbidden, deleteObj.StatusCode);
    }

    [Fact]
    public async Task IrmOpportunities_Create_Pitch_Commit_Returns403_ForGhlAdmin()
    {
        var mockService = new Mock<IOpportunityService>();
        var controller = new IrmOpportunitiesController(mockService.Object);
        SetControllerContext(controller, CreateClaimsPrincipal(1, 1, "company_admin"));

        var createResult = await controller.Create(new CreateOpportunityDto { Title = "Fund III" }, CancellationToken.None);
        var createObj = Assert.IsType<ObjectResult>(createResult);
        Assert.Equal(StatusCodes.Status403Forbidden, createObj.StatusCode);

        var pitchResult = await controller.Pitch(10, new PitchOpportunityDto { InvestorId = 2 }, CancellationToken.None);
        var pitchObj = Assert.IsType<ObjectResult>(pitchResult);
        Assert.Equal(StatusCodes.Status403Forbidden, pitchObj.StatusCode);

        var commitResult = await controller.Commit(10, new CommitOpportunityDto { CommittedAmount = 1000000 }, CancellationToken.None);
        var commitObj = Assert.IsType<ObjectResult>(commitResult);
        Assert.Equal(StatusCodes.Status403Forbidden, commitObj.StatusCode);
    }

    [Fact]
    public async Task IrmCalls_LogCall_Returns403_ForGhlAdmin()
    {
        var mockService = new Mock<IInvestorCallService>();
        var controller = new IrmCallsController(mockService.Object);
        SetControllerContext(controller, CreateClaimsPrincipal(1, 1, "super_admin"));

        var result = await controller.LogCall(new LogCallDto { InvestorId = 5, DurationSeconds = 60 }, CancellationToken.None);
        var objResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, objResult.StatusCode);
    }

    [Fact]
    public async Task GhlDeals_UpdateIrmDeal_Returns403_ForGhlAdmin()
    {
        using var db = CreateInMemoryDbContext(Guid.NewGuid().ToString());
        var role = new Role { Id = 1, Code = "company_admin", Name = "Company Admin" };
        var agent = new User { Id = 1, Name = "Admin User", RoleId = 1, Role = role, CompanyId = 1 };
        db.Roles.Add(role);
        db.Users.Add(agent);

        var deal = new GhlDeal
        {
            Id = 1,
            CompanyId = 1,
            AssignedAgentId = 1,
            AssignedAgent = agent,
            Title = "HNI Investment Deal",
            CustomerName = "Rajesh Sharma",
            Stage = "investment_opportunity",
            Value = 5000000
        };
        db.GhlDeals.Add(deal);
        await db.SaveChangesAsync();

        var mockCurrent = new Mock<ICurrentUserService>();
        mockCurrent.Setup(c => c.UserId).Returns(1);
        mockCurrent.Setup(c => c.CompanyId).Returns(1);
        mockCurrent.Setup(c => c.Role).Returns("company_admin");

        var controller = new GhlDealsController(db, mockCurrent.Object);
        SetControllerContext(controller, CreateClaimsPrincipal(1, 1, "company_admin"));

        var updateResult = await controller.UpdateDeal(1, new UpdateGhlDealDto { Value = 6000000 }, CancellationToken.None);
        var objResult = Assert.IsType<ObjectResult>(updateResult.Result);
        Assert.Equal(StatusCodes.Status403Forbidden, objResult.StatusCode);
    }

    [Fact]
    public async Task GhlInvestors_CreateInvestor_Returns403_ForGhlAdmin()
    {
        using var db = CreateInMemoryDbContext(Guid.NewGuid().ToString());
        var mockCurrent = new Mock<ICurrentUserService>();
        mockCurrent.Setup(c => c.UserId).Returns(1);
        mockCurrent.Setup(c => c.CompanyId).Returns(1);
        mockCurrent.Setup(c => c.Role).Returns("company_admin");

        var controller = new GhlInvestorsController(db, mockCurrent.Object);
        SetControllerContext(controller, CreateClaimsPrincipal(1, 1, "company_admin"));

        var createResult = await controller.CreateInvestor(new CreateGhlInvestorDto
        {
            Name = "New Investor",
            Phone = "+919876543210"
        }, CancellationToken.None);

        var objResult = Assert.IsType<ObjectResult>(createResult.Result);
        Assert.Equal(StatusCodes.Status403Forbidden, objResult.StatusCode);
    }

    [Fact]
    public async Task GhlOpportunities_CreateOpportunity_Returns403_ForGhlAdmin()
    {
        using var db = CreateInMemoryDbContext(Guid.NewGuid().ToString());
        var mockCurrent = new Mock<ICurrentUserService>();
        mockCurrent.Setup(c => c.UserId).Returns(1);
        mockCurrent.Setup(c => c.CompanyId).Returns(1);
        mockCurrent.Setup(c => c.Role).Returns("company_admin");

        var controller = new GhlOpportunitiesController(db, mockCurrent.Object);
        SetControllerContext(controller, CreateClaimsPrincipal(1, 1, "company_admin"));

        var createResult = await controller.CreateOpportunity(new CreateGhlOpportunityDto
        {
            InvestorId = 1,
            Title = "CRE Tranche A"
        }, CancellationToken.None);

        var objResult = Assert.IsType<ObjectResult>(createResult.Result);
        Assert.Equal(StatusCodes.Status403Forbidden, objResult.StatusCode);
    }

    [Fact]
    public async Task IrmPipeline_MoveStage_AllowsIrmUser()
    {
        var mockService = new Mock<IIrmPipelineService>();
        mockService.Setup(s => s.MoveStageAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<MoveIrmStageDto>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(ApiResponse<IrmPipelineCardDto>.SuccessResponse(new IrmPipelineCardDto()));

        var controller = new IrmPipelineController(mockService.Object);
        SetControllerContext(controller, CreateClaimsPrincipal(5, 1, "irm"));

        var result = await controller.MoveStage(10, new MoveIrmStageDto { TargetStageId = "converted" }, CancellationToken.None);
        var okResult = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(StatusCodes.Status200OK, okResult.StatusCode);
    }
}
