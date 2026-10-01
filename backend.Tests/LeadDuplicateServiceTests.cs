using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using backend.Authentication.Interfaces;
using backend.Data;
using backend.DTOs.Leads;
using backend.Models.Entities;
using backend.Models.Enums;
using backend.Services.Implementations;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace backend.Tests;

public class LeadDuplicateServiceTests
{
    private ApplicationDbContext CreateInMemoryDbContext(string dbName)
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: dbName)
            .Options;
        return new ApplicationDbContext(options);
    }

    private Mock<ICurrentUserService> CreateMockCurrentUser(int userId = 10, int companyId = 1, string role = "sales_executive")
    {
        var mock = new Mock<ICurrentUserService>();
        mock.Setup(u => u.UserId).Returns(userId);
        mock.Setup(u => u.CompanyId).Returns(companyId);
        mock.Setup(u => u.Role).Returns(role);
        mock.Setup(u => u.Email).Returns("testagent@ghl.com");
        mock.Setup(u => u.IsAuthenticated).Returns(true);
        return mock;
    }

    [Fact]
    public void Normalization_ExtractsLast10Digits_AndLowercasesEmail()
    {
        // Phone normalization
        Assert.Equal("9876543210", LeadService.NormalizePhone("+91 98765-43210"));
        Assert.Equal("9876543210", LeadService.NormalizePhone("(987) 654-3210"));
        Assert.Equal("9876543210", LeadService.NormalizePhone("09876543210"));
        Assert.Null(LeadService.NormalizePhone("12345")); // too short
        Assert.Null(LeadService.NormalizePhone(""));
        Assert.Null(LeadService.NormalizePhone(null));

        // Email normalization
        Assert.Equal("john.doe@example.com", LeadService.NormalizeEmail("  John.Doe@Example.COM  "));
        Assert.Null(LeadService.NormalizeEmail(""));
        Assert.Null(LeadService.NormalizeEmail("   "));
        Assert.Null(LeadService.NormalizeEmail(null));
    }

    [Fact]
    public async Task CreateLeadAsync_WhenContactAlreadyExistsInFollowup_ReturnsDuplicateInFollowup_AndDoesNotCreateLead()
    {
        var dbName = Guid.NewGuid().ToString();
        using var db = CreateInMemoryDbContext(dbName);

        var agent = new User { Id = 10, CompanyId = 1, Name = "Agent Alpha", Email = "alpha@ghl.com", RoleId = 1 };
        db.Users.Add(agent);

        // Existing lead with status 'Follow-up Required'
        var existingLead = new Lead
        {
            Id = 101,
            CompanyId = 1,
            AssignedAgentId = 10,
            Name = "Priya Sharma",
            Phone = "+91 98765 43210",
            Email = "priya.sharma@example.com",
            Status = "Follow-up Required",
            CreatedAt = DateTime.UtcNow.AddDays(-2)
        };
        db.Leads.Add(existingLead);

        // And an active pending followup
        var followup = new Followup
        {
            Id = 201,
            CompanyId = 1,
            AssignedAgentId = 10,
            ContactId = "101",
            ContactType = "lead",
            ContactName = "Priya Sharma",
            ContactPhone = "9876543210",
            Status = FollowupStatus.Pending,
            ScheduledAt = DateTime.UtcNow.AddDays(1)
        };
        db.Followups.Add(followup);
        await db.SaveChangesAsync();

        var mockUser = CreateMockCurrentUser(userId: 10, companyId: 1, role: "sales_executive");
        var leadService = new LeadService(db, mockUser.Object);

        var dto = new CreateLeadDto
        {
            CompanyId = 1,
            Name = "Priya Sharma",
            Phone = "9876543210", // differently formatted phone
            Email = "PRIYA.SHARMA@EXAMPLE.COM",
            Status = "New"
        };

        var result = await leadService.CreateLeadAsync(dto);

        // Assert rejection
        Assert.False(result.Success);
        Assert.Contains("already exists in Follow-up", result.Message);
        Assert.Contains(result.Errors!, e => e == "DUPLICATE_IN_FOLLOWUP");
        Assert.Contains(result.Errors!, e => e.StartsWith("CONTACT_ID:101"));

        // Verify total leads remains 1 (no duplicate created)
        var totalLeads = await db.Leads.CountAsync();
        Assert.Equal(1, totalLeads);

        // Verify existing lead status was NOT overwritten to 'New' or 'Interested'
        var reloadedLead = await db.Leads.FindAsync(101);
        Assert.Equal("Follow-up Required", reloadedLead!.Status);
    }

    [Fact]
    public async Task CreateLeadAsync_WhenCustomerExistsInFollowup_ReturnsDuplicateInFollowup()
    {
        var dbName = Guid.NewGuid().ToString();
        using var db = CreateInMemoryDbContext(dbName);

        var agent = new User { Id = 10, CompanyId = 1, Name = "Agent Alpha", Email = "alpha@ghl.com", RoleId = 1 };
        db.Users.Add(agent);

        // Existing Customer
        var existingCust = new Customer
        {
            Id = 301,
            CompanyId = 1,
            AssignedAgentId = 10,
            Name = "Rahul Verma",
            Phone = "+91 9988776655",
            Email = "rahul@verma.com",
            Status = "Active"
        };
        db.Customers.Add(existingCust);

        // Pending follow-up for this customer
        var followup = new Followup
        {
            Id = 401,
            CompanyId = 1,
            AssignedAgentId = 10,
            ContactId = "301",
            ContactType = "customer",
            ContactName = "Rahul Verma",
            ContactPhone = "9988776655",
            Status = FollowupStatus.Pending,
            ScheduledAt = DateTime.UtcNow.AddDays(2)
        };
        db.Followups.Add(followup);
        await db.SaveChangesAsync();

        var mockUser = CreateMockCurrentUser(userId: 10, companyId: 1, role: "sales_executive");
        var leadService = new LeadService(db, mockUser.Object);

        var dto = new CreateLeadDto
        {
            CompanyId = 1,
            Name = "Rahul Verma",
            Phone = "99887-76655",
            Email = "rahul@verma.com"
        };

        var result = await leadService.CreateLeadAsync(dto);

        Assert.False(result.Success);
        Assert.Contains("already exists in Follow-up", result.Message);
        Assert.Contains(result.Errors!, e => e == "DUPLICATE_IN_FOLLOWUP");
        Assert.Contains(result.Errors!, e => e.StartsWith("CONTACT_TYPE:customer"));

        // No new lead created
        Assert.Empty(await db.Leads.ToListAsync());
    }

    [Fact]
    public async Task CreateLeadAsync_WhenCustomerExistsWithoutFollowup_ReturnsDuplicateCustomerError()
    {
        var dbName = Guid.NewGuid().ToString();
        using var db = CreateInMemoryDbContext(dbName);

        var agent = new User { Id = 10, CompanyId = 1, Name = "Agent Alpha", Email = "alpha@ghl.com", RoleId = 1 };
        db.Users.Add(agent);

        var existingCust = new Customer
        {
            Id = 302,
            CompanyId = 1,
            AssignedAgentId = 10,
            Name = "Amit Patel",
            Phone = "9123456780",
            Email = "amit@patel.com"
        };
        db.Customers.Add(existingCust);
        await db.SaveChangesAsync();

        var mockUser = CreateMockCurrentUser(userId: 10, companyId: 1, role: "sales_executive");
        var leadService = new LeadService(db, mockUser.Object);

        var dto = new CreateLeadDto
        {
            CompanyId = 1,
            Name = "Amit Patel",
            Phone = "+91 91234-56780"
        };

        var result = await leadService.CreateLeadAsync(dto);

        Assert.False(result.Success);
        Assert.Contains("customer already exists", result.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Contains(result.Errors!, e => e == "DUPLICATE_CUSTOMER");
        Assert.Empty(await db.Leads.ToListAsync());
    }

    [Fact]
    public async Task CreateLeadAsync_WhenNoPhoneOrEmail_CreatesLeadWithoutBlockingUnrelatedRecords()
    {
        var dbName = Guid.NewGuid().ToString();
        using var db = CreateInMemoryDbContext(dbName);

        var mockUser = CreateMockCurrentUser(userId: 10, companyId: 1, role: "sales_executive");
        var leadService = new LeadService(db, mockUser.Object);

        // Lead 1: no phone, no email
        var dto1 = new CreateLeadDto
        {
            CompanyId = 1,
            Name = "Walk-in Lead 1",
            Phone = "",
            Email = ""
        };
        var res1 = await leadService.CreateLeadAsync(dto1);
        Assert.True(res1.Success);

        // Lead 2: another walk-in with no phone or email should NOT be blocked
        var dto2 = new CreateLeadDto
        {
            CompanyId = 1,
            Name = "Walk-in Lead 2",
            Phone = "",
            Email = ""
        };
        var res2 = await leadService.CreateLeadAsync(dto2);
        Assert.True(res2.Success);

        Assert.Equal(2, await db.Leads.CountAsync());
    }

    [Fact]
    public async Task CreateLeadAsync_ConcurrencySafe_SimultaneousRequestsDoNotProduceDuplicates()
    {
        var dbName = Guid.NewGuid().ToString();
        using var db = CreateInMemoryDbContext(dbName);

        var mockUser = CreateMockCurrentUser(userId: 10, companyId: 1, role: "sales_executive");
        var leadService = new LeadService(db, mockUser.Object);

        var dto = new CreateLeadDto
        {
            CompanyId = 1,
            Name = "Simultaneous Customer",
            Phone = "9876500001",
            Email = "simultaneous@example.com"
        };

        // Launch two simultaneous creation requests for the exact same contact
        var task1 = leadService.CreateLeadAsync(dto);
        var task2 = leadService.CreateLeadAsync(dto);

        var results = await Task.WhenAll(task1, task2);

        // One should succeed with lead created, and the other should either update or detect duplicate
        var totalCreated = await db.Leads.CountAsync(l => l.Phone == "9876500001");
        Assert.Equal(1, totalCreated); // Strictly 1 record in database!
    }
}
