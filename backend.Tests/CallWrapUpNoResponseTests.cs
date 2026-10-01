using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using backend.Authentication.Interfaces;
using backend.Controllers.Irm;
using backend.Controllers.SalesExecutive;
using backend.Data;
using backend.DTOs.Calls;
using backend.DTOs.Common;
using backend.DTOs.Irm;
using backend.Models.Entities;
using backend.Services.Implementations;
using backend.Services.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace backend.Tests;

public class CallWrapUpNoResponseTests
{
    private ApplicationDbContext CreateInMemoryDbContext(string dbName)
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: dbName)
            .Options;
        return new ApplicationDbContext(options);
    }

    private ClaimsPrincipal CreateClaimsPrincipal(int userId, int companyId, string role, string name = "Rajesh IRM")
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new("userId", userId.ToString()),
            new("company_id", companyId.ToString()),
            new(ClaimTypes.Role, role),
            new("role", role),
            new(ClaimTypes.Email, $"{role}@ghl.com"),
            new(ClaimTypes.Name, name)
        };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        return new ClaimsPrincipal(identity);
    }

    [Fact]
    public async Task SendCustomerMessage_ReturnsDeliveryUnavailable_WhenNoEmailAddressProvided()
    {
        // Arrange
        using var context = CreateInMemoryDbContext(nameof(SendCustomerMessage_ReturnsDeliveryUnavailable_WhenNoEmailAddressProvided));
        var user = new User { Id = 10, Name = "Vikram IRM", Email = "vikram@ghl.com", RoleId = 3, CompanyId = 1 };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var mockCurrentUser = new Mock<ICurrentUserService>();
        mockCurrentUser.Setup(m => m.UserId).Returns(10);
        mockCurrentUser.Setup(m => m.CompanyId).Returns(1);
        mockCurrentUser.Setup(m => m.Role).Returns("irm");

        var mockCallService = new Mock<ICallService>();
        var mockEmailService = new Mock<IEmailService>();

        var controller = new SalesExecutiveCallsController(context, mockCurrentUser.Object, mockCallService.Object, mockEmailService.Object)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = CreateClaimsPrincipal(10, 1, "irm", "Vikram IRM") }
            }
        };

        var request = new SendCustomerMessageRequestDto
        {
            RecipientName = "Amit Patel",
            RecipientPhone = "+91 9876543210",
            RecipientEmail = "", // No email address
            Message = "Tried calling you regarding your portfolio inquiry."
        };

        // Act
        var actionResult = await controller.SendCustomerMessage(request, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(actionResult.Result);
        var apiResponse = Assert.IsType<ApiResponse<SendCustomerMessageResponseDto>>(okResult.Value);
        Assert.False(apiResponse.Data!.Delivered);
        Assert.False(apiResponse.Data!.Success);
        Assert.Contains("unavailable", apiResponse.Data!.DeliveryResult, StringComparison.OrdinalIgnoreCase);
        // Ensure email service was NOT called
        mockEmailService.Verify(e => e.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task SendCustomerMessage_DispatchesEmailAndRecordsActivity_WhenEmailIsProvided()
    {
        // Arrange
        using var context = CreateInMemoryDbContext(nameof(SendCustomerMessage_DispatchesEmailAndRecordsActivity_WhenEmailIsProvided));
        var user = new User { Id = 12, Name = "Sneha IRM", Email = "sneha@ghl.com", RoleId = 3, CompanyId = 1 };
        var customer = new Customer { Id = 50, CompanyId = 1, Name = "Kiran Rao", Email = "kiran@example.com", Phone = "+91 9988776655", AssignedAgentId = 12 };
        var deal = new GhlDeal { Id = 100, CompanyId = 1, CustomerId = 50, Title = "Kiran Investment Deal", Stage = "leads", AssignedAgentId = 12 };
        context.Users.Add(user);
        context.Customers.Add(customer);
        context.GhlDeals.Add(deal);
        await context.SaveChangesAsync();

        var mockCurrentUser = new Mock<ICurrentUserService>();
        mockCurrentUser.Setup(m => m.UserId).Returns(12);
        mockCurrentUser.Setup(m => m.CompanyId).Returns(1);
        mockCurrentUser.Setup(m => m.Role).Returns("irm");

        var mockCallService = new Mock<ICallService>();
        var mockEmailService = new Mock<IEmailService>();
        mockEmailService.Setup(e => e.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var controller = new SalesExecutiveCallsController(context, mockCurrentUser.Object, mockCallService.Object, mockEmailService.Object)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = CreateClaimsPrincipal(12, 1, "irm", "Sneha IRM") }
            }
        };

        var request = new SendCustomerMessageRequestDto
        {
            RecipientName = "Kiran Rao",
            RecipientPhone = "+91 9988776655",
            RecipientEmail = "kiran@example.com",
            CustomerId = 50,
            DealId = 100,
            Message = "Hello Kiran, I tried calling you today regarding your wealth plan. Follow-up scheduled for tomorrow."
        };

        // Act
        var actionResult = await controller.SendCustomerMessage(request, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(actionResult.Result);
        var apiResponse = Assert.IsType<ApiResponse<SendCustomerMessageResponseDto>>(okResult.Value);
        Assert.True(apiResponse.Data!.Delivered);
        Assert.True(apiResponse.Data!.Success);
        Assert.Equal("Sneha IRM", apiResponse.Data!.SentByName);
        Assert.Contains("Delivered successfully", apiResponse.Data!.DeliveryResult);

        // Verify customer notes updated with attribution to signed-in IRM
        var updatedCustomer = await context.Customers.FindAsync(50);
        Assert.NotNull(updatedCustomer);
        Assert.Contains("Sneha IRM", updatedCustomer.Notes);
        Assert.Contains("No Response Follow-up Message", updatedCustomer.Notes);

        // Verify deal activity logged
        var activities = await context.GhlDealActivities.Where(a => a.DealId == 100).ToListAsync();
        Assert.Single(activities);
        Assert.Equal("Sneha IRM", activities[0].LoggedByName);
        Assert.Contains("No Response Message", activities[0].Text);
    }

    [Fact]
    public async Task CallService_ProcessDispositionAsync_UpdatesLeadAndCreatesFollowup_OnNoResponse()
    {
        // Arrange
        using var context = CreateInMemoryDbContext(nameof(CallService_ProcessDispositionAsync_UpdatesLeadAndCreatesFollowup_OnNoResponse));
        var lead = new Lead { Id = 33, CompanyId = 1, AssignedAgentId = 5, Name = "Pooja Varma", Phone = "+91 9123456780", Status = "New" };
        context.Leads.Add(lead);
        await context.SaveChangesAsync();

        var mockCurrentUser = new Mock<ICurrentUserService>();
        mockCurrentUser.Setup(m => m.UserId).Returns(5);
        mockCurrentUser.Setup(m => m.CompanyId).Returns(1);

        var callService = new CallService(context, mockCurrentUser.Object);

        var request = new CallDispositionDto
        {
            LeadId = 33,
            ContactName = "Pooja Varma",
            ContactPhone = "+91 9123456780",
            Disposition = "No Response",
            Notes = "Called client, no answer. Left voicemail and follow-up scheduled.",
            FollowupAt = DateTime.UtcNow.AddDays(1)
        };

        // Act
        var result = await callService.ProcessDispositionAsync(request, CancellationToken.None);

        // Assert
        Assert.True(result.Success);
        var updatedLead = await context.Leads.FindAsync(33);
        Assert.NotNull(updatedLead);
        Assert.Equal("No Response", updatedLead.Status);

        var followups = await context.Followups.Where(f => f.ContactId == "33").ToListAsync();
        Assert.Single(followups);
        Assert.Equal("Pooja Varma", followups[0].ContactName);
        Assert.Equal(5, followups[0].AssignedAgentId);
    }

    [Fact]
    public async Task GetCalls_ScopesToOwnCalls_WhenRoleIsIrm()
    {
        // Arrange
        using var context = CreateInMemoryDbContext(nameof(GetCalls_ScopesToOwnCalls_WhenRoleIsIrm));
        var irm1 = new User { Id = 101, Name = "IRM User 1", Email = "irm1@ghl.com", RoleId = 3, CompanyId = 1 };
        var irm2 = new User { Id = 102, Name = "IRM User 2", Email = "irm2@ghl.com", RoleId = 3, CompanyId = 1 };
        context.Users.AddRange(irm1, irm2);

        var call1 = new CallRecord { Id = 1, CompanyId = 1, AgentId = 101, ContactName = "Client A", ContactPhone = "+91 9999900001", Disposition = "Interested", Timestamp = DateTime.UtcNow };
        var call2 = new CallRecord { Id = 2, CompanyId = 1, AgentId = 102, ContactName = "Client B", ContactPhone = "+91 9999900002", Disposition = "Interested", Timestamp = DateTime.UtcNow };
        context.CallRecords.AddRange(call1, call2);
        await context.SaveChangesAsync();

        var mockCurrentUser = new Mock<ICurrentUserService>();
        mockCurrentUser.Setup(m => m.UserId).Returns(101);
        mockCurrentUser.Setup(m => m.CompanyId).Returns(1);
        mockCurrentUser.Setup(m => m.Role).Returns("irm");

        var mockCallService = new Mock<ICallService>();
        var mockEmailService = new Mock<IEmailService>();

        var controller = new SalesExecutiveCallsController(context, mockCurrentUser.Object, mockCallService.Object, mockEmailService.Object)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = CreateClaimsPrincipal(101, 1, "irm", "IRM User 1") }
            }
        };

        // Act
        var result = await controller.GetCalls(null, null, null, null, null, null, null, 1, 20, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var apiRes = Assert.IsType<ApiResponse<PagedResult<CallRecordResponseDto>>>(okResult.Value);
        Assert.Single(apiRes.Data!.Items);
        Assert.Equal(101, apiRes.Data.Items[0].AgentId);
        Assert.Equal("Client A", apiRes.Data.Items[0].ContactName);
    }

    [Fact]
    public async Task GetCallById_ReturnsCall_WhenUserIsOwner()
    {
        // Arrange
        using var context = CreateInMemoryDbContext(nameof(GetCallById_ReturnsCall_WhenUserIsOwner));
        var irm1 = new User { Id = 201, Name = "IRM User 1", Email = "irm1@ghl.com", RoleId = 3, CompanyId = 1 };
        context.Users.Add(irm1);

        var call = new CallRecord { Id = 50, CompanyId = 1, AgentId = 201, ContactName = "Client X", ContactPhone = "+91 9888800001", Disposition = "No Response", Duration = 45, Timestamp = DateTime.UtcNow, Notes = "Tried calling client" };
        context.CallRecords.Add(call);
        await context.SaveChangesAsync();

        var mockCurrentUser = new Mock<ICurrentUserService>();
        mockCurrentUser.Setup(m => m.UserId).Returns(201);
        mockCurrentUser.Setup(m => m.CompanyId).Returns(1);
        mockCurrentUser.Setup(m => m.Role).Returns("irm");

        var controller = new SalesExecutiveCallsController(context, mockCurrentUser.Object, Mock.Of<ICallService>(), Mock.Of<IEmailService>())
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = CreateClaimsPrincipal(201, 1, "irm", "IRM User 1") }
            }
        };

        // Act
        var actionResult = await controller.GetCallById(call.Id, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(actionResult.Result);
        var apiRes = Assert.IsType<ApiResponse<CallRecordResponseDto>>(okResult.Value);
        Assert.True(apiRes.Success);
        Assert.Equal(call.Id, apiRes.Data!.Id);
        Assert.Equal("Client X", apiRes.Data.ContactName);
        Assert.Equal(201, apiRes.Data.AgentId);
    }

    [Fact]
    public async Task GetCallById_Returns403Forbidden_WhenIrmAttemptsToViewAnotherIrmsCall()
    {
        // Arrange
        using var context = CreateInMemoryDbContext(nameof(GetCallById_Returns403Forbidden_WhenIrmAttemptsToViewAnotherIrmsCall));
        var user2 = new User { Id = 202, Name = "Other IRM", Email = "other@ghl.com", RoleId = 3, CompanyId = 1 };
        context.Users.Add(user2);
        var call = new CallRecord { Id = 51, CompanyId = 1, AgentId = 202, ContactName = "Other Client", ContactPhone = "+91 9888800002", Disposition = "Interested", Timestamp = DateTime.UtcNow };
        context.CallRecords.Add(call);
        await context.SaveChangesAsync();

        var mockCurrentUser = new Mock<ICurrentUserService>();
        mockCurrentUser.Setup(m => m.UserId).Returns(201); // User 201 trying to access call belonging to User 202
        mockCurrentUser.Setup(m => m.CompanyId).Returns(1);
        mockCurrentUser.Setup(m => m.Role).Returns("irm");

        var controller = new SalesExecutiveCallsController(context, mockCurrentUser.Object, Mock.Of<ICallService>(), Mock.Of<IEmailService>())
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = CreateClaimsPrincipal(201, 1, "irm", "IRM User 1") }
            }
        };

        // Act
        var actionResult = await controller.GetCallById(call.Id, CancellationToken.None);

        // Assert
        var statusResult = Assert.IsType<ObjectResult>(actionResult.Result);
        Assert.Equal(StatusCodes.Status403Forbidden, statusResult.StatusCode);
        var apiRes = Assert.IsType<ApiResponse<CallRecordResponseDto>>(statusResult.Value);
        Assert.False(apiRes.Success);
        Assert.Contains("Access denied", apiRes.Message);
    }

    [Fact]
    public void GetMessagingChannels_ReturnsChannelsWithRealProviderStatus()
    {
        // Arrange
        using var context = CreateInMemoryDbContext(nameof(GetMessagingChannels_ReturnsChannelsWithRealProviderStatus));
        var controller = new SalesExecutiveCallsController(context, Mock.Of<ICurrentUserService>(), Mock.Of<ICallService>(), Mock.Of<IEmailService>());

        // Act
        var result = controller.GetMessagingChannels();

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var apiRes = Assert.IsType<ApiResponse<List<MessagingChannelStatusDto>>>(okResult.Value);
        var channels = apiRes.Data!;
        Assert.Equal(3, channels.Count);

        var emailChannel = channels.Find(c => c.Channel == "email");
        Assert.NotNull(emailChannel);
        Assert.True(emailChannel.Configured);
        Assert.Contains("SMTP", emailChannel.Provider);

        var smsChannel = channels.Find(c => c.Channel == "sms");
        Assert.NotNull(smsChannel);
        Assert.False(smsChannel.Configured);
        Assert.Contains("No SMS gateway", smsChannel.StatusMessage);

        var whatsappChannel = channels.Find(c => c.Channel == "whatsapp");
        Assert.NotNull(whatsappChannel);
        Assert.False(whatsappChannel.Configured);
        Assert.Contains("No WhatsApp Business API", whatsappChannel.StatusMessage);
    }

    [Theory]
    [InlineData("sms")]
    [InlineData("whatsapp")]
    public async Task SendCustomerMessage_ReturnsUnavailable_WhenSmsOrWhatsAppSelected(string channel)
    {
        // Arrange
        using var context = CreateInMemoryDbContext($"SendCustomerMessage_Unavailable_{channel}");
        var user = new User { Id = 301, Name = "Priya IRM", Email = "priya@ghl.com", RoleId = 3, CompanyId = 1 };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var mockCurrentUser = new Mock<ICurrentUserService>();
        mockCurrentUser.Setup(m => m.UserId).Returns(301);
        mockCurrentUser.Setup(m => m.CompanyId).Returns(1);
        mockCurrentUser.Setup(m => m.Role).Returns("irm");

        var controller = new SalesExecutiveCallsController(context, mockCurrentUser.Object, Mock.Of<ICallService>(), Mock.Of<IEmailService>())
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = CreateClaimsPrincipal(301, 1, "irm", "Priya IRM") }
            }
        };

        var request = new SendCustomerMessageRequestDto
        {
            Channel = channel,
            RecipientName = "Rohan Sharma",
            RecipientPhone = "+91 9111122222",
            Message = "Follow-up message regarding property allocation."
        };

        // Act
        var actionResult = await controller.SendCustomerMessage(request, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(actionResult.Result);
        var apiRes = Assert.IsType<ApiResponse<SendCustomerMessageResponseDto>>(okResult.Value);
        Assert.False(apiRes.Data!.Delivered);
        Assert.False(apiRes.Data.Success);
        Assert.Equal(channel, apiRes.Data.Channel);
        Assert.Contains("unavailable", apiRes.Data.DeliveryResult, StringComparison.OrdinalIgnoreCase);
        Assert.Contains(channel == "sms" ? "SMS gateway" : "WhatsApp Business API", apiRes.Data.DeliveryResult);
    }

    [Fact]
    public async Task IrmCallsController_GetAll_OverridesQueryParamWithCurrentUserId_ForIrmRole()
    {
        // Arrange
        var mockService = new Mock<IInvestorCallService>();
        mockService.Setup(s => s.GetAllAsync(1, 401, It.IsAny<CancellationToken>()))
            .ReturnsAsync(ApiResponse<List<CallLogDto>>.SuccessResponse(new List<CallLogDto>
            {
                new() { Id = 1, IrmId = 401, InvestorName = "Authorized Investor", Outcome = "Interested" }
            }));

        var controller = new IrmCallsController(mockService.Object)
        {
            ControllerContext = new ControllerContext
            {
                // IRM user with ID 401
                HttpContext = new DefaultHttpContext { User = CreateClaimsPrincipal(401, 1, "irm", "Anil IRM") }
            }
        };

        // Act: User 401 tries to pass ?irmId=999 to see user 999's calls
        var result = await controller.GetAll(999, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        // Verify callService was called with irmId = 401 (ownership enforced), NOT 999!
        mockService.Verify(s => s.GetAllAsync(1, 401, It.IsAny<CancellationToken>()), Times.Once);
        mockService.Verify(s => s.GetAllAsync(1, 999, It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task IrmCallsController_GetById_Returns403_WhenAccessDenied()
    {
        // Arrange
        var mockService = new Mock<IInvestorCallService>();
        mockService.Setup(s => s.GetByIdAsync(77, 1, 401, "irm", It.IsAny<CancellationToken>()))
            .ReturnsAsync(ApiResponse<CallLogDto>.ErrorResponse("Access denied: You are only authorized to view your own call records."));

        var controller = new IrmCallsController(mockService.Object)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = CreateClaimsPrincipal(401, 1, "irm", "Anil IRM") }
            }
        };

        // Act
        var result = await controller.GetById(77, CancellationToken.None);

        // Assert
        var statusResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, statusResult.StatusCode);
    }
}
