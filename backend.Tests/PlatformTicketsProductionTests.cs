using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using backend.Authentication.Interfaces;
using backend.Controllers;
using backend.Controllers.SuperAdmin;
using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.SuperAdmin;
using backend.Models.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace backend.Tests;

public class PlatformTicketsProductionTests
{
    private readonly DbContextOptions<ApplicationDbContext> _dbOptions;

    public PlatformTicketsProductionTests()
    {
        _dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: $"PlatformTicketsTestDb_{Guid.NewGuid()}")
            .Options;
    }

    private (PlatformTicketsController controller, ApplicationDbContext context) CreateController(string email = "superadmin@nexusplatform.io")
    {
        var context = new ApplicationDbContext(_dbOptions);

        var currentUserMock = new Mock<ICurrentUserService>();
        currentUserMock.Setup(c => c.Email).Returns(email);
        currentUserMock.Setup(c => c.UserId).Returns(1);
        currentUserMock.Setup(c => c.Role).Returns("super_admin");

        var controller = new PlatformTicketsController(context, currentUserMock.Object);

        var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, "1"),
            new Claim(ClaimTypes.Email, email),
            new Claim(ClaimTypes.Role, "super_admin")
        }, "TestAuth"));

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        };

        return (controller, context);
    }

    [Fact]
    public async Task GetTickets_WhenDatabaseIsEmpty_ReturnsEmptyListAndNoMockData()
    {
        var (controller, _) = CreateController();

        var actionResult = await controller.GetTickets(null, null, null, null, null);
        var okResult = Assert.IsType<OkObjectResult>(actionResult.Result);
        var response = Assert.IsType<ApiResponse<List<PlatformTicketDto>>>(okResult.Value);

        Assert.True(response.Success);
        Assert.NotNull(response.Data);
        Assert.Empty(response.Data);
    }

    [Fact]
    public async Task GetTicketMetrics_WhenDatabaseIsEmpty_ReturnsZeroes()
    {
        var (controller, _) = CreateController();

        var actionResult = await controller.GetTicketMetrics();
        var okResult = Assert.IsType<OkObjectResult>(actionResult.Result);
        var response = Assert.IsType<ApiResponse<PlatformTicketMetricsDto>>(okResult.Value);

        Assert.True(response.Success);
        Assert.Equal(0, response.Data.Total);
        Assert.Equal(0, response.Data.Critical);
        Assert.Equal(0, response.Data.InProgress);
        Assert.Equal(0, response.Data.Resolved);
        Assert.Equal(0, response.Data.Open);
        Assert.Equal(0, response.Data.StatusCounts["open"]);
        Assert.Equal(0, response.Data.StatusCounts["in_progress"]);
    }

    [Fact]
    public async Task CreateTicket_WithValidInput_PersistsToDatabaseAndCreatesAuditLog()
    {
        var (controller, context) = CreateController();

        var tenant = new Tenant { Name = "Acme Corp", Slug = "acme" };
        context.Tenants.Add(tenant);
        await context.SaveChangesAsync();

        var req = new CreatePlatformTicketRequestDto
        {
            Title = "High Latency on Speech AI Engine",
            Description = "ASR audio chunks dropping above 350ms in Mumbai availability zone.",
            Category = "Speech AI / Transcription",
            Priority = "critical",
            TenantId = tenant.Id,
            ReportedByName = "NOC Operations Team",
            ReportedByEmail = "noc@acme.internal",
            AssignedToName = "Network Engineering Team"
        };

        var actionResult = await controller.CreateTicket(req);
        var okResult = Assert.IsType<OkObjectResult>(actionResult.Result);
        var response = Assert.IsType<ApiResponse<PlatformTicketDto>>(okResult.Value);

        Assert.True(response.Success);
        var created = response.Data;
        Assert.StartsWith("INC-", created.TicketNumber);
        Assert.Equal("High Latency on Speech AI Engine", created.Title);
        Assert.Equal("critical", created.Priority);
        Assert.Equal("open", created.Status);
        Assert.Equal(tenant.Id, created.TenantId);
        Assert.Equal("Acme Corp", created.TenantName);
        Assert.Single(created.Timeline);
        Assert.Equal("system_alert", created.Timeline[0].Type);

        // Verify in DB
        var dbTicket = await context.PlatformTickets.Include(t => t.Timeline).FirstOrDefaultAsync(t => t.TicketNumber == created.TicketNumber);
        Assert.NotNull(dbTicket);
        Assert.Single(dbTicket.Timeline);

        // Verify Audit Log
        var audit = await context.AuditLogs.FirstOrDefaultAsync(a => a.EntityId == created.TicketNumber);
        Assert.NotNull(audit);
        Assert.Equal("ticket_created", audit.Action);
    }

    [Fact]
    public async Task FilterAndSearch_CombinesQueryParametersCorrectly()
    {
        var (controller, context) = CreateController();

        context.PlatformTickets.AddRange(
            new PlatformTicket
            {
                TicketNumber = "INC-2026-0001",
                Title = "Tata SIP Trunk Disconnects",
                Description = "SIP gateway timed out after 3000ms",
                Category = "Telephony / Carrier Trunk",
                Priority = "critical",
                Status = "in_progress",
                ReportedByName = "Super Admin",
                ReportedByEmail = "superadmin@nexusplatform.io",
                CreatedAt = DateTime.UtcNow.AddHours(-2)
            },
            new PlatformTicket
            {
                TicketNumber = "INC-2026-0002",
                Title = "GHL Investor KYC Document Upload Failed",
                Description = "Investor uploaded 15MB file which exceeded size limit",
                Category = "Tenant Operational",
                Priority = "low",
                Status = "resolved",
                ReportedByName = "Mani Admin",
                ReportedByEmail = "mani@ghlindiaventures.com",
                CreatedAt = DateTime.UtcNow.AddHours(-1)
            },
            new PlatformTicket
            {
                TicketNumber = "INC-2026-0003",
                Title = "High Priority Jitter on Outbound Gateway",
                Description = "Replica latency spike",
                Category = "Database / Latency",
                Priority = "high",
                Status = "open",
                ReportedByName = "NOC Operations",
                ReportedByEmail = "noc@nexusplatform.io",
                CreatedAt = DateTime.UtcNow.AddMinutes(-30)
            }
        );
        await context.SaveChangesAsync();

        // 1. Search by keyword
        var searchResult = await controller.GetTickets(null, null, null, null, "trunk");
        var searchOk = Assert.IsType<OkObjectResult>(searchResult.Result);
        var searchData = Assert.IsType<ApiResponse<List<PlatformTicketDto>>>(searchOk.Value).Data;
        Assert.Single(searchData);
        Assert.Equal("INC-2026-0001", searchData[0].TicketNumber);

        // 2. Filter by status
        var statusResult = await controller.GetTickets("resolved", null, null, null, null);
        var statusOk = Assert.IsType<OkObjectResult>(statusResult.Result);
        var statusData = Assert.IsType<ApiResponse<List<PlatformTicketDto>>>(statusOk.Value).Data;
        Assert.Single(statusData);
        Assert.Equal("INC-2026-0002", statusData[0].TicketNumber);

        // 3. Filter by priority
        var priorityResult = await controller.GetTickets(null, "critical", null, null, null);
        var priorityOk = Assert.IsType<OkObjectResult>(priorityResult.Result);
        var priorityData = Assert.IsType<ApiResponse<List<PlatformTicketDto>>>(priorityOk.Value).Data;
        Assert.Single(priorityData);
        Assert.Equal("INC-2026-0001", priorityData[0].TicketNumber);

        // 3b. Filter by combined critical_high
        var criticalHighResult = await controller.GetTickets(null, "critical_high", null, null, null);
        var criticalHighOk = Assert.IsType<OkObjectResult>(criticalHighResult.Result);
        var criticalHighData = Assert.IsType<ApiResponse<List<PlatformTicketDto>>>(criticalHighOk.Value).Data;
        Assert.Equal(2, criticalHighData.Count);
        Assert.Contains(criticalHighData, t => t.Priority == "critical");
        Assert.Contains(criticalHighData, t => t.Priority == "high");

        // 4. Combined non-matching filter
        var mismatchResult = await controller.GetTickets("resolved", "critical", null, null, null);
        var mismatchOk = Assert.IsType<OkObjectResult>(mismatchResult.Result);
        var mismatchData = Assert.IsType<ApiResponse<List<PlatformTicketDto>>>(mismatchOk.Value).Data;
        Assert.Empty(mismatchData);
    }

    [Fact]
    public async Task UpdateStatus_ToResolved_SavesResolutionNotesAndTimestamp()
    {
        var (controller, context) = CreateController();

        var ticket = new PlatformTicket
        {
            TicketNumber = "INC-2026-0010",
            Title = "Database Read Replica Spike",
            Description = "Replica CPU saturated at 95%",
            Category = "Database / Latency",
            Priority = "high",
            Status = "in_progress",
            ReportedByName = "Operations",
            ReportedByEmail = "noc@internal.io"
        };
        context.PlatformTickets.Add(ticket);
        await context.SaveChangesAsync();

        var res = await controller.UpdateStatus(ticket.Id.ToString(), new UpdateTicketStatusRequestDto
        {
            Status = "resolved",
            Note = "Scaled read replica pool from 2 to 4 instances.",
            ResolutionNotes = "Pool scale completed. Latency normalized under 25ms."
        });

        var ok = Assert.IsType<OkObjectResult>(res.Result);
        var data = Assert.IsType<ApiResponse<PlatformTicketDto>>(ok.Value).Data;

        Assert.Equal("resolved", data.Status);
        Assert.NotNull(data.ResolvedAt);
        Assert.Equal("Pool scale completed. Latency normalized under 25ms.", data.ResolutionNotes);
        Assert.Contains(data.Timeline, ev => ev.Type == "status_change");

        // Verify in DB
        var db = await context.PlatformTickets.FindAsync(ticket.Id);
        Assert.NotNull(db?.ResolvedAt);
    }

    [Fact]
    public async Task UpdateStatus_ReopeningResolvedTicket_ClearsResolvedAtAndLogsReopenEvent()
    {
        var (controller, context) = CreateController();

        var ticket = new PlatformTicket
        {
            TicketNumber = "INC-2026-0020",
            Title = "Airtel Trunk Intermittent Audio Gaps",
            Description = "Codec mismatch causing one-way audio",
            Category = "Telephony / Carrier Trunk",
            Priority = "medium",
            Status = "resolved",
            ResolvedAt = DateTime.UtcNow.AddHours(-5),
            ResolutionNotes = "Codec G.711 forced."
        };
        context.PlatformTickets.Add(ticket);
        await context.SaveChangesAsync();

        var res = await controller.UpdateStatus(ticket.Id.ToString(), new UpdateTicketStatusRequestDto
        {
            Status = "in_progress",
            Note = "Issue resurfaced on secondary gateway."
        });

        var ok = Assert.IsType<OkObjectResult>(res.Result);
        var data = Assert.IsType<ApiResponse<PlatformTicketDto>>(ok.Value).Data;

        Assert.Equal("in_progress", data.Status);
        Assert.Null(data.ResolvedAt);
        Assert.Contains(data.Timeline, ev => ev.Type == "reopen");
    }

    [Fact]
    public async Task AssignTicket_UpdatesAssigneeAndAppendsTimelineEvent()
    {
        var (controller, context) = CreateController();

        var ticket = new PlatformTicket
        {
            TicketNumber = "INC-2026-0030",
            Title = "Tenant Token Expiration",
            Description = "Tokens expiring early",
            Category = "Security & Auth",
            Priority = "high",
            Status = "open",
            AssignedToName = "Platform Operations"
        };
        context.PlatformTickets.Add(ticket);
        await context.SaveChangesAsync();

        var res = await controller.AssignTicket(ticket.Id.ToString(), new AssignTicketRequestDto
        {
            AssignedToName = "Yanosh (Lead Architect)",
            AssignedToEmail = "yanosh@ghlindiaventures.com",
            Note = "Assigned for direct authentication pipeline inspection."
        });

        var ok = Assert.IsType<OkObjectResult>(res.Result);
        var data = Assert.IsType<ApiResponse<PlatformTicketDto>>(ok.Value).Data;

        Assert.Equal("Yanosh (Lead Architect)", data.AssignedToName);
        Assert.Equal("yanosh@ghlindiaventures.com", data.AssignedToEmail);
        Assert.Contains(data.Timeline, ev => ev.Type == "assignment_change");
    }

    [Fact]
    public async Task AddNote_AppendsOperationalDiagnosticUpdate()
    {
        var (controller, context) = CreateController();

        var ticket = new PlatformTicket
        {
            TicketNumber = "INC-2026-0040",
            Title = "Outbound Call Flapping",
            Description = "Carrier returned 503",
            Category = "Telephony / Carrier Trunk",
            Priority = "critical",
            Status = "in_progress"
        };
        context.PlatformTickets.Add(ticket);
        await context.SaveChangesAsync();

        var res = await controller.AddNote(ticket.Id.ToString(), new AddTicketNoteRequestDto
        {
            Message = "Engaged carrier Tier 3 support. Packet capture traces attached."
        });

        var ok = Assert.IsType<OkObjectResult>(res.Result);
        var data = Assert.IsType<ApiResponse<PlatformTicketDto>>(ok.Value).Data;

        Assert.Single(data.Timeline);
        Assert.Equal("note", data.Timeline[0].Type);
        Assert.Equal("Engaged carrier Tier 3 support. Packet capture traces attached.", data.Timeline[0].Message);
    }

    [Fact]
    public async Task DeleteTicket_RemovesFromDatabase()
    {
        var (controller, context) = CreateController();

        var ticket = new PlatformTicket
        {
            TicketNumber = "INC-2026-0050",
            Title = "Accidental Duplicate Alert",
            Description = "Duplicate alert generated during synthetic test",
            Category = "Tenant Operational",
            Priority = "low",
            Status = "open"
        };
        context.PlatformTickets.Add(ticket);
        await context.SaveChangesAsync();

        var res = await controller.DeleteTicket(ticket.Id.ToString());
        var ok = Assert.IsType<OkObjectResult>(res.Result);
        var data = Assert.IsType<ApiResponse<bool>>(ok.Value);

        Assert.True(data.Data);
        Assert.Null(await context.PlatformTickets.FindAsync(ticket.Id));
    }

    private (SupportTicketsController controller, ApplicationDbContext context) CreateTenantController(
        string email = "naveen@ghlindiaventures.com",
        int userId = 3,
        string role = "sales_executive",
        int companyId = 1)
    {
        var context = new ApplicationDbContext(_dbOptions);

        var currentUserMock = new Mock<ICurrentUserService>();
        currentUserMock.Setup(c => c.Email).Returns(email);
        currentUserMock.Setup(c => c.Name).Returns("Naveen");
        currentUserMock.Setup(c => c.UserId).Returns(userId);
        currentUserMock.Setup(c => c.Role).Returns(role);
        currentUserMock.Setup(c => c.CompanyId).Returns(companyId);

        var controller = new SupportTicketsController(context, currentUserMock.Object);

        var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim(ClaimTypes.Email, email),
            new Claim(ClaimTypes.Role, role)
        }, "TestAuth"));

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        };

        return (controller, context);
    }

    [Fact]
    public async Task TenantRaisesTicket_AssignsToPlatformOperationsAndRecordsTenant()
    {
        var (controller, context) = CreateTenantController();

        var tenant = new Tenant
        {
            Id = 1,
            Name = "GHL India Ventures",
            Slug = "ghl"
        };
        context.Tenants.Add(tenant);
        await context.SaveChangesAsync();

        var res = await controller.CreateTenantTicket(new CreatePlatformTicketRequestDto
        {
            Title = "VoIP outbound latency spike",
            Description = "Call dropped during consultation",
            Category = "Telephony / Carrier Trunk",
            Priority = "high"
        });

        var ok = Assert.IsType<OkObjectResult>(res.Result);
        var data = Assert.IsType<ApiResponse<PlatformTicketDto>>(ok.Value).Data;

        Assert.NotNull(data);
        Assert.Equal("VoIP outbound latency spike", data.Title);
        Assert.Equal("GHL India Ventures", data.TenantName);
        Assert.Equal(1, data.TenantId);
        Assert.Equal("Platform Operations", data.AssignedToName);
        Assert.Contains("Naveen (Sales Executive)", data.ReportedByName);
        Assert.NotEmpty(data.Timeline);
    }

    [Fact]
    public async Task TenantIsolation_Company2CannotSeeCompany1Tickets()
    {
        var (c1Controller, context) = CreateTenantController("naveen@ghlindiaventures.com", 3, "sales_executive", 1);

        context.PlatformTickets.Add(new PlatformTicket
        {
            TicketNumber = "INC-2026-0091",
            Title = "Company 1 Secret Incident",
            Description = "Internal latency issue",
            Category = "Tenant Operational",
            Priority = "medium",
            Status = "open",
            TenantId = 1
        });
        await context.SaveChangesAsync();

        // Query as Company 1 user
        var c1Res = await c1Controller.GetTenantTickets();
        var c1Ok = Assert.IsType<OkObjectResult>(c1Res.Result);
        var c1Data = Assert.IsType<ApiResponse<List<PlatformTicketDto>>>(c1Ok.Value).Data;
        Assert.Contains(c1Data, t => t.TicketNumber == "INC-2026-0091");

        // Query as Company 2 user (Mani - Jamin Bazaar)
        var (c2Controller, _) = CreateTenantController("mani@jaminbazaar.com", 4, "company_admin", 2);
        var c2Res = await c2Controller.GetTenantTickets();
        var c2Ok = Assert.IsType<OkObjectResult>(c2Res.Result);
        var c2Data = Assert.IsType<ApiResponse<List<PlatformTicketDto>>>(c2Ok.Value).Data;
        Assert.DoesNotContain(c2Data, t => t.TicketNumber == "INC-2026-0091");
    }

    [Fact]
    public async Task TenantReopen_RestoresTicketToOpenState()
    {
        var (controller, context) = CreateTenantController();

        var ticket = new PlatformTicket
        {
            TicketNumber = "INC-2026-0092",
            Title = "Reoccurrence of SIP Bug",
            Description = "Resolved previously",
            Category = "Telephony / Carrier Trunk",
            Priority = "medium",
            Status = "resolved",
            TenantId = 1,
            ResolutionNotes = "Resolved previously",
            ResolvedAt = DateTime.UtcNow
        };
        context.PlatformTickets.Add(ticket);
        await context.SaveChangesAsync();

        var res = await controller.ReopenTenantTicket(ticket.Id.ToString(), new AddTicketNoteRequestDto
        {
            Message = "Issue reoccurred after restart"
        });

        var ok = Assert.IsType<OkObjectResult>(res.Result);
        var data = Assert.IsType<ApiResponse<PlatformTicketDto>>(ok.Value).Data;

        Assert.Equal("open", data.Status);
        Assert.Null(data.ResolutionNotes);
        Assert.Null(data.ResolvedAt);
        Assert.Contains(data.Timeline, ev => ev.Type == "status_change" && ev.Message.Contains("Issue reoccurred after restart"));
    }
}
