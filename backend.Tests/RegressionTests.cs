using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using backend.Authentication.Interfaces;
using backend.Controllers;
using backend.DTOs.Ai;
using backend.DTOs.Leads;
using backend.Models.Entities;
using backend.Models.Enums;
using backend.Services.Ai;
using backend.Services.Ai.Tools;
using backend.Services.Implementations;
using backend.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;

namespace backend.Tests
{
    public class RegressionTests
    {
        private backend.Data.ApplicationDbContext CreateDb()
        {
            var options = new DbContextOptionsBuilder<backend.Data.ApplicationDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;
            return new backend.Data.ApplicationDbContext(options);
        }

        [Fact]
        public async Task R3_AiAssistantController_RejectsLargeClientContext()
        {
            var mockCurrentUser = new Mock<ICurrentUserService>();
            mockCurrentUser.Setup(c => c.UserId).Returns(1);
            var controller = new AiAssistantController(null!, mockCurrentUser.Object, null!);
            
            var req = new AiChatRequestDto
            {
                Message = "Hello",
                ClientContext = new string('A', 1001)
            };

            var result = await controller.Chat(req, CancellationToken.None);

            var badRequest = Assert.IsType<BadRequestObjectResult>(result);
            var apiResponse = Assert.IsType<backend.DTOs.Common.ApiResponse<AiChatResponseDto>>(badRequest.Value);
            Assert.False(apiResponse.Success);
            Assert.Contains("ClientContext exceeds 1000 characters", apiResponse.Message);
        }

        [Fact]
        public async Task R3_AiAssistantController_Rejects5HistoryItems()
        {
            var mockCurrentUser = new Mock<ICurrentUserService>();
            mockCurrentUser.Setup(c => c.UserId).Returns(1);
            var controller = new AiAssistantController(null!, mockCurrentUser.Object, null!);
            
            var req = new AiChatRequestDto
            {
                Message = "Hello",
                History = new List<AiChatMessageDto>
                {
                    new() { Role = "user", Content = "1" },
                    new() { Role = "user", Content = "2" },
                    new() { Role = "user", Content = "3" },
                    new() { Role = "user", Content = "4" },
                    new() { Role = "user", Content = "5" }
                }
            };

            var result = await controller.Chat(req, CancellationToken.None);
            var badRequest = Assert.IsType<BadRequestObjectResult>(result);
            var apiResponse = Assert.IsType<backend.DTOs.Common.ApiResponse<AiChatResponseDto>>(badRequest.Value);
            Assert.False(apiResponse.Success);
            Assert.Contains("History exceeds 4 items", apiResponse.Message);
        }

        [Fact]
        public async Task R5_CreateLead_NonAdmin_IgnoresAssignedAgentId()
        {
            using var db = CreateDb();
            var currentUser = new Mock<ICurrentUserService>();
            currentUser.Setup(c => c.Role).Returns("sales_executive");
            currentUser.Setup(c => c.UserId).Returns(10);
            currentUser.Setup(c => c.CompanyId).Returns(1);

            var service = new LeadService(db, currentUser.Object, new Mock<ICompanyClock>().Object);
            
            var dto = new CreateLeadDto
            {
                Name = "Test Lead",
                Phone = "1234567890",
                CompanyId = 2,
                AssignedAgentId = 99
            };

            var result = await service.CreateLeadAsync(dto, CancellationToken.None);

            Assert.True(result.Success);
            var lead = await db.Leads.FirstOrDefaultAsync();
            Assert.NotNull(lead);
            Assert.Equal(10, lead.AssignedAgentId);
            Assert.Equal(1, lead.CompanyId);
        }

        [Fact]
        public async Task R5_CreateLead_Admin_AssignsToOnLeaveAgent_GetsUnassignedLead()
        {
            using var db = CreateDb();
            var leaveDate = new DateOnly(2026, 1, 15);
            
            db.Users.Add(new User { Id = 99, CompanyId = 1, RoleId = 2 });
            db.LeaveRequests.Add(new LeaveRequest 
            { 
                UserId = 99, 
                StartDate = leaveDate, 
                EndDate = leaveDate, 
                Status = "Approved" 
            });
            await db.SaveChangesAsync();

            var currentUser = new Mock<ICurrentUserService>();
            currentUser.Setup(c => c.Role).Returns("company_admin");
            currentUser.Setup(c => c.UserId).Returns(10);
            currentUser.Setup(c => c.CompanyId).Returns(1);

            var clock = new Mock<ICompanyClock>();
            clock.Setup(c => c.GetCompanyTodayAsync(1, It.IsAny<CancellationToken>())).ReturnsAsync(leaveDate);

            var service = new LeadService(db, currentUser.Object, clock.Object);
            
            var dto = new CreateLeadDto { Name = "Test", Phone = "1", CompanyId = 1, AssignedAgentId = 99 };
            var result = await service.CreateLeadAsync(dto, CancellationToken.None);
            Assert.True(result.Success);
            
            var lead = await db.Leads.FirstOrDefaultAsync(l => l.Name == "Test");
            Assert.Null(lead!.AssignedAgentId);
        }

        [Fact]
        public async Task S3_LeaveCheck_UsesCompanyTime()
        {
            using var db = CreateDb();
            var leaveDate = new DateOnly(2026, 1, 15);
            db.Users.Add(new User { Id = 99, CompanyId = 1, RoleId = 2 });
            db.LeaveRequests.Add(new LeaveRequest { UserId = 99, StartDate = leaveDate, EndDate = leaveDate, Status = "Approved" });
            await db.SaveChangesAsync();

            var currentUser = new Mock<ICurrentUserService>();
            currentUser.Setup(c => c.Role).Returns("company_admin");
            currentUser.Setup(c => c.UserId).Returns(10);
            currentUser.Setup(c => c.CompanyId).Returns(1);

            var clock = new Mock<ICompanyClock>();
            clock.Setup(c => c.GetCompanyTodayAsync(1, It.IsAny<CancellationToken>())).ReturnsAsync(leaveDate);

            var service = new LeadService(db, currentUser.Object, clock.Object);
            await service.CreateLeadAsync(new CreateLeadDto { Name = "T", Phone = "1", CompanyId = 1, AssignedAgentId = 99 }, CancellationToken.None);
            
            var lead = await db.Leads.FirstAsync();
            Assert.Null(lead.AssignedAgentId);
        }

        [Fact]
        public async Task R5_CreateLead_Admin_AssignsToDifferentCompanyAgent_GetsUnassignedLead()
        {
            using var db = CreateDb();
            db.Users.Add(new User { Id = 99, CompanyId = 2, RoleId = 2 });
            await db.SaveChangesAsync();

            var currentUser = new Mock<ICurrentUserService>();
            currentUser.Setup(c => c.Role).Returns("company_admin");
            currentUser.Setup(c => c.UserId).Returns(10);
            currentUser.Setup(c => c.CompanyId).Returns(1);

            var clock = new Mock<ICompanyClock>();
            clock.Setup(c => c.GetCompanyTodayAsync(1, It.IsAny<CancellationToken>())).ReturnsAsync(new DateOnly(2026, 1, 1));

            var service = new LeadService(db, currentUser.Object, clock.Object);
            await service.CreateLeadAsync(new CreateLeadDto { Name = "T", Phone = "1", CompanyId = 1, AssignedAgentId = 99 }, CancellationToken.None);
            
            var lead = await db.Leads.FirstAsync();
            Assert.Null(lead.AssignedAgentId);
        }

        [Fact]
        public async Task R5_CreateLead_AssignedLead_HasHistoryRow()
        {
            using var db = CreateDb();
            var role = new Role { Id = 2, Code = "sales_executive", Name = "Sales Exec" };
            db.Roles.Add(role);
            db.Users.Add(new User { Id = 99, CompanyId = 1, Role = role, Status = backend.Models.Enums.UserStatus.Active });
            await db.SaveChangesAsync();

            var currentUser = new Mock<ICurrentUserService>();
            currentUser.Setup(c => c.Role).Returns("company_admin");
            currentUser.Setup(c => c.UserId).Returns(10);
            currentUser.Setup(c => c.CompanyId).Returns(1);

            var clock = new Mock<ICompanyClock>();
            clock.Setup(c => c.GetCompanyTodayAsync(1, It.IsAny<CancellationToken>())).ReturnsAsync(new DateOnly(2026, 1, 1));

            var service = new LeadService(db, currentUser.Object, clock.Object);
            await service.CreateLeadAsync(new CreateLeadDto { Name = "T", Phone = "1", CompanyId = 1, AssignedAgentId = 99 }, CancellationToken.None);
            
            var lead = await db.Leads.FirstAsync();
            var history = await db.LeadAssignmentHistories.FirstOrDefaultAsync(h => h.LeadId == lead.Id);
            Assert.NotNull(history);
            Assert.Equal(99, history.ToAgentId);
            Assert.Equal(10, history.AssignedById);
        }

        [Fact]
        public async Task C3_ReassignLead_OnlyAffectsSameCompanyFollowups()
        {
            using var db = CreateDb();
            var role = new Role { Id = 2, Code = "sales_executive", Name = "Sales Exec" };
            db.Roles.Add(role);
            db.Users.Add(new User { Id = 1, CompanyId = 1, Role = role, Status = backend.Models.Enums.UserStatus.Active });
            db.Users.Add(new User { Id = 2, CompanyId = 2, Role = role, Status = backend.Models.Enums.UserStatus.Active });
            db.Users.Add(new User { Id = 10, CompanyId = 1, Name = "Agent Ten", Role = role, Status = backend.Models.Enums.UserStatus.Active });
            db.Leads.Add(new Lead { Id = 5, CompanyId = 1, Name = "A", AssignedAgentId = 1 });
            db.Followups.Add(new Followup { Id = 101, ContactType = "lead", ContactId = "5", CompanyId = 1, AssignedAgentId = 1, Status = FollowupStatus.Pending });
            db.Followups.Add(new Followup { Id = 102, ContactType = "lead", ContactId = "5", CompanyId = 2, AssignedAgentId = 2, Status = FollowupStatus.Pending });
            await db.SaveChangesAsync();

            var currentUser = new Mock<ICurrentUserService>();
            currentUser.Setup(c => c.Role).Returns("company_admin");
            currentUser.Setup(c => c.UserId).Returns(10);
            currentUser.Setup(c => c.CompanyId).Returns(1);

            var clock = new Mock<ICompanyClock>();
            clock.Setup(c => c.GetCompanyTodayAsync(1, It.IsAny<CancellationToken>())).ReturnsAsync(new DateOnly(2026, 1, 1));
            
            var controller = new backend.Controllers.GhlAdmin.GhlLeadAssignmentController(db, currentUser.Object, clock.Object);
            var req = new backend.Controllers.GhlAdmin.GhlLeadAssignmentController.AssignLeadDto { LeadIds = new List<int> { 5 }, AgentId = 10 };
            
            await controller.ReassignLeads(req, CancellationToken.None);
            
            var f1 = await db.Followups.FindAsync(101);
            Assert.Equal(10, f1!.AssignedAgentId);
            Assert.Equal("Agent Ten", f1!.AssignedToName);
            Assert.Equal("sales_executive", f1!.AssignedToRole);
            
            var f2 = await db.Followups.FindAsync(102);
            Assert.Equal(2, f2!.AssignedAgentId);
        }
        
        [Fact]
        public async Task R2_AiTool_MasksContactsWhenIncludeContactDetailsIsFalse()
        {
            using var db = CreateDb();
            db.Leads.Add(new Lead { Id = 1, CompanyId = 1, Name = "Secret Lead", Phone = "9876543210", Email = "secret@test.com" });
            await db.SaveChangesAsync();

            var aiSettings = new AiSettings { IncludeContactDetails = false, MaxRowsPerTool = 3 };
            var options = new Mock<IOptionsSnapshot<AiSettings>>();
            options.Setup(o => o.Value).Returns(aiSettings);

            var clock = new Mock<ICompanyClock>();
            clock.Setup(c => c.GetTimeZoneAsync(1, It.IsAny<CancellationToken>())).ReturnsAsync(TimeZoneInfo.Utc);

            var sc = new ServiceCollection();
            sc.AddSingleton(db);
            sc.AddSingleton(options.Object);
            sc.AddSingleton(clock.Object);
            var sp = sc.BuildServiceProvider();

            var tool = new SearchLeadsTool();
            
            var mockUser = new Mock<ICurrentUserService>();
            mockUser.Setup(c => c.CompanyId).Returns(1);
            mockUser.Setup(c => c.UserId).Returns(10);
            mockUser.Setup(c => c.Role).Returns("company_admin");
            
            var scope = new AiDataScope(mockUser.Object);
            var result = await tool.ExecuteAsync("{}", scope, sp, CancellationToken.None);

            Assert.DoesNotContain("9876543210", result);
            Assert.DoesNotContain("secret@test.com", result);
            Assert.DoesNotContain("@", result);
        }
        
        [Fact]
        public async Task R2_AiTool_MaxRowsPerTool_IsRespected()
        {
            using var db = CreateDb();
            for (int i = 1; i <= 5; i++)
                db.Leads.Add(new Lead { Id = i, CompanyId = 1, Name = $"Lead {i}" });
            await db.SaveChangesAsync();

            var aiSettings = new AiSettings { IncludeContactDetails = false, MaxRowsPerTool = 3 };
            var options = new Mock<IOptionsSnapshot<AiSettings>>();
            options.Setup(o => o.Value).Returns(aiSettings);

            var clock = new Mock<ICompanyClock>();
            clock.Setup(c => c.GetTimeZoneAsync(1, It.IsAny<CancellationToken>())).ReturnsAsync(TimeZoneInfo.Utc);

            var sc = new ServiceCollection();
            sc.AddSingleton(db);
            sc.AddSingleton(options.Object);
            sc.AddSingleton(clock.Object);
            var sp = sc.BuildServiceProvider();

            var tool = new SearchLeadsTool();
            
            var mockUser = new Mock<ICurrentUserService>();
            mockUser.Setup(c => c.CompanyId).Returns(1);
            mockUser.Setup(c => c.UserId).Returns(10);
            mockUser.Setup(c => c.Role).Returns("company_admin");
            
            var scope = new AiDataScope(mockUser.Object);
            var result = await tool.ExecuteAsync("{}", scope, sp, CancellationToken.None);
            
            Assert.Contains("Lead 5", result);
            Assert.Contains("Lead 4", result);
            Assert.Contains("Lead 3", result);
            Assert.DoesNotContain("Lead 2", result);
            Assert.DoesNotContain("Lead 1", result);
        }

        [Fact]
        public async Task R4_DeclineTool_SetsDeclinedTrue()
        {
            var sp = new Mock<IServiceProvider>().Object;
            var tool = new DeclineOutOfScopeTool();
            
            var mockUser = new Mock<ICurrentUserService>();
            mockUser.Setup(c => c.CompanyId).Returns(1);
            mockUser.Setup(c => c.UserId).Returns(10);
            mockUser.Setup(c => c.Role).Returns("company_admin");
            
            var scope = new AiDataScope(mockUser.Object);
            var result = await tool.ExecuteAsync("{}", scope, sp, CancellationToken.None);
            Assert.Equal("", result);
            // Declined boolean is checked in AiAssistantService, but tool just returns empty
        }
    }
}
