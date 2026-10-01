using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using backend.Controllers.Irm;
using backend.Data;
using backend.DTOs.Common;
using backend.DTOs.Irm;
using backend.Models.Entities;
using backend.Models.Enums;
using backend.Repositories.Interfaces;
using backend.Services.Implementations;
using backend.Services.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace backend.Tests;

public class IrmKycControllerTests
{
    private ApplicationDbContext CreateInMemoryDbContext(string dbName)
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: dbName)
            .Options;
        return new ApplicationDbContext(options);
    }

    private ClaimsPrincipal CreateClaimsPrincipal(int userId, int companyId, string role, bool hasKycVerify)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new("userId", userId.ToString()),
            new("company_id", companyId.ToString()),
            new(ClaimTypes.Role, role),
            new(ClaimTypes.Email, "irm_officer@ghl.com"),
            new(ClaimTypes.Name, "IRM Officer")
        };
        if (hasKycVerify)
        {
            claims.Add(new Claim("permission", "kyc.verify"));
        }
        var identity = new ClaimsIdentity(claims, "TestAuth");
        return new ClaimsPrincipal(identity);
    }

    [Fact]
    public async Task UpdateKycStatus_Returns403_WhenUserLacksKycVerifyPermission()
    {
        using var db = CreateInMemoryDbContext(Guid.NewGuid().ToString());
        var user = new User
        {
            Id = 10,
            CompanyId = 1,
            Name = "Sales Rep",
            Email = "rep@ghl.com",
            Role = new Role { Id = 4, Name = "Sales Executive", Code = "sales_executive", Permissions = new List<string> { "leads.view" } }
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var controller = new IrmKycController(Mock.Of<IKycService>(), Mock.Of<IOtpService>(), db);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = CreateClaimsPrincipal(10, 1, "sales_executive", hasKycVerify: false)
            }
        };

        var dto = new UpdateKycStatusDto { Status = "Verified" };
        var result = await controller.UpdateKycStatus(1, dto, CancellationToken.None);

        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, objectResult.StatusCode);
    }

    [Fact]
    public async Task UpdateKycStatus_Returns409_WhenCustomerHasNotSubmitted()
    {
        using var db = CreateInMemoryDbContext(Guid.NewGuid().ToString());
        var kyc = new InvestorKyc
        {
            Id = 1,
            CompanyId = 1,
            InvestorId = 101,
            Status = KycStatus.Draft,
            SubmittedAt = null
        };
        db.InvestorKycs.Add(kyc);
        await db.SaveChangesAsync();

        var controller = new IrmKycController(Mock.Of<IKycService>(), Mock.Of<IOtpService>(), db);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = CreateClaimsPrincipal(5, 1, "irm", hasKycVerify: true)
            }
        };

        var dto = new UpdateKycStatusDto
        {
            Status = "Verified",
            Checklist = new KycChecklistDto { Identity = true, Bank = true, Documents = true, Nominee = true, Demat = true }
        };
        var result = await controller.UpdateKycStatus(1, dto, CancellationToken.None);

        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status409Conflict, objectResult.StatusCode);
    }

    [Fact]
    public async Task UpdateKycStatus_Returns400_WhenChecklistIsIncompleteForVerified()
    {
        using var db = CreateInMemoryDbContext(Guid.NewGuid().ToString());
        var kyc = new InvestorKyc
        {
            Id = 2,
            CompanyId = 1,
            InvestorId = 102,
            Status = KycStatus.PendingReview,
            SubmittedAt = DateTime.UtcNow
        };
        db.InvestorKycs.Add(kyc);
        await db.SaveChangesAsync();

        var controller = new IrmKycController(Mock.Of<IKycService>(), Mock.Of<IOtpService>(), db);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = CreateClaimsPrincipal(5, 1, "irm", hasKycVerify: true)
            }
        };

        var dto = new UpdateKycStatusDto
        {
            Status = "Verified",
            Checklist = new KycChecklistDto
            {
                Identity = true,
                Bank = true,
                Documents = false, // Incomplete!
                Nominee = true,
                Demat = true
            }
        };
        var result = await controller.UpdateKycStatus(2, dto, CancellationToken.None);

        var badRequestResult = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal(StatusCodes.Status400BadRequest, badRequestResult.StatusCode);
    }

    [Fact]
    public async Task UpdateKycStatus_Returns400_WhenWrongWithoutComment()
    {
        using var db = CreateInMemoryDbContext(Guid.NewGuid().ToString());
        var kyc = new InvestorKyc
        {
            Id = 3,
            CompanyId = 1,
            InvestorId = 103,
            Status = KycStatus.PendingReview,
            SubmittedAt = DateTime.UtcNow
        };
        db.InvestorKycs.Add(kyc);
        await db.SaveChangesAsync();

        var controller = new IrmKycController(Mock.Of<IKycService>(), Mock.Of<IOtpService>(), db);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = CreateClaimsPrincipal(5, 1, "irm", hasKycVerify: true)
            }
        };

        var dto = new UpdateKycStatusDto
        {
            Status = "Wrong",
            Comment = "" // Missing mandatory comment
        };
        var result = await controller.UpdateKycStatus(3, dto, CancellationToken.None);

        var badRequestResult = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal(StatusCodes.Status400BadRequest, badRequestResult.StatusCode);
    }

    [Fact]
    public async Task UpdateKycStatus_SetsVerifiedAndAuditTrail_WhenValid()
    {
        using var db = CreateInMemoryDbContext(Guid.NewGuid().ToString());
        var kyc = new InvestorKyc
        {
            Id = 4,
            CompanyId = 1,
            InvestorId = 104,
            InvestorName = "Priya Sharma",
            Status = KycStatus.PendingReview,
            SubmittedAt = DateTime.UtcNow
        };
        var deal = new GhlDeal
        {
            Id = 44,
            CompanyId = 1,
            CustomerId = 104,
            CustomerName = "Priya Sharma",
            KycStatus = "Pending"
        };
        db.InvestorKycs.Add(kyc);
        db.GhlDeals.Add(deal);
        await db.SaveChangesAsync();

        var controller = new IrmKycController(Mock.Of<IKycService>(), Mock.Of<IOtpService>(), db);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = CreateClaimsPrincipal(5, 1, "irm", hasKycVerify: true)
            }
        };

        var dto = new UpdateKycStatusDto
        {
            Status = "Verified",
            Comment = "All submitted documents verified with NSDL and UIDAI match.",
            Checklist = new KycChecklistDto { Identity = true, Bank = true, Documents = true, Nominee = true, Demat = true }
        };
        var result = await controller.UpdateKycStatus(4, dto, CancellationToken.None);

        var okResult = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(StatusCodes.Status200OK, okResult.StatusCode);

        // Verify KYC record
        var updatedKyc = await db.InvestorKycs.FindAsync(4);
        Assert.NotNull(updatedKyc);
        Assert.Equal(KycStatus.Approved, updatedKyc.Status);
        Assert.Equal("irm_officer@ghl.com", updatedKyc.VerifiedBy);
        Assert.NotNull(updatedKyc.VerifiedAt);

        // Verify linked deal updated
        var updatedDeal = await db.GhlDeals.FindAsync(44);
        Assert.NotNull(updatedDeal);
        Assert.Equal("Verified", updatedDeal.KycStatus);
        Assert.Equal("irm_officer@ghl.com", updatedDeal.VerifiedBy);

        // Verify audit log
        var audit = await db.AuditLogs.FirstOrDefaultAsync(a => a.EntityId == "4");
        Assert.NotNull(audit);
        Assert.Equal("irm_officer@ghl.com", audit.ActorEmail);
        Assert.Contains("Verified", audit.Details);
    }

    [Fact]
    public async Task SubmitKycAsync_PublicEndpoint_CanNeverSetVerifiedOrWrong()
    {
        var mockKycRepo = new Mock<IKycRepository>();
        InvestorKyc capturedKyc = null!;
        mockKycRepo.Setup(r => r.GetByTokenAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((string token, CancellationToken ct) => new InvestorKyc
            {
                Id = 99,
                CompanyId = 1,
                Status = KycStatus.ReuploadRequested, // Was "Wrong"
                Remarks = "Previous PAN mismatch",
                VerifiedBy = "fake@bad.com"
            });

        mockKycRepo.Setup(r => r.UpdateAsync(It.IsAny<InvestorKyc>(), It.IsAny<CancellationToken>()))
            .Callback<InvestorKyc, CancellationToken>((k, ct) => capturedKyc = k)
            .ReturnsAsync((InvestorKyc k, CancellationToken ct) => k);

        var service = new KycService(
            mockKycRepo.Object,
            Mock.Of<IInvestorRepository>(),
            Mock.Of<IEmailService>(),
            Mock.Of<ILogger<KycService>>());

        var submitDto = new SubmitKycDto
        {
            Token = "valid-token",
            IsFinalSubmit = true,
            InvestorName = "Test Investor",
            PanNumber = "ABCDE1234F"
        };

        var result = await service.SubmitKycAsync(1, submitDto, CancellationToken.None);

        Assert.True(result.Success);
        Assert.NotNull(capturedKyc);
        // Can never be Approved (Verified) or ReuploadRequested (Wrong)
        Assert.Equal(KycStatus.PendingReview, capturedKyc.Status);
        // Verification details reset to null
        Assert.Null(capturedKyc.VerifiedBy);
        Assert.Null(capturedKyc.VerifiedAt);
        Assert.Null(capturedKyc.Remarks);
        Assert.NotNull(capturedKyc.SubmittedAt);
    }

    // ── SaveVerificationDraft (PATCH /api/irm/kyc/{id}/verification) ─────────

    [Fact]
    public async Task SaveVerificationDraft_Returns403_WhenUserLacksKycVerifyPermission()
    {
        using var db = CreateInMemoryDbContext(Guid.NewGuid().ToString());
        var user = new User
        {
            Id = 20, CompanyId = 1, Name = "No-Perm User", Email = "noperm@ghl.com",
            Role = new Role { Id = 5, Name = "Viewer", Code = "viewer", Permissions = new List<string> { "deals.view" } }
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var controller = new IrmKycController(Mock.Of<IKycService>(), Mock.Of<IOtpService>(), db);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = CreateClaimsPrincipal(20, 1, "viewer", hasKycVerify: false) }
        };

        var dto = new SaveVerificationDraftDto
        {
            Aadhaar = new SectionVerificationDto { Status = "verified" },
            Pan     = new SectionVerificationDto { Status = "unchecked" },
            Bank    = new SectionVerificationDto { Status = "unchecked" }
        };
        var result = await controller.SaveVerificationDraft(1, dto, CancellationToken.None);

        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, objectResult.StatusCode);
    }

    [Fact]
    public async Task SaveVerificationDraft_Returns400_WhenWrongSectionHasNoReason()
    {
        using var db = CreateInMemoryDbContext(Guid.NewGuid().ToString());
        var kyc = new InvestorKyc { Id = 10, CompanyId = 1, InvestorId = 200, Status = KycStatus.PendingReview, SubmittedAt = DateTime.UtcNow };
        db.InvestorKycs.Add(kyc);
        await db.SaveChangesAsync();

        var controller = new IrmKycController(Mock.Of<IKycService>(), Mock.Of<IOtpService>(), db);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = CreateClaimsPrincipal(5, 1, "irm", hasKycVerify: true) }
        };

        var dto = new SaveVerificationDraftDto
        {
            Aadhaar = new SectionVerificationDto { Status = "wrong", Reason = null }, // Missing reason
            Pan     = new SectionVerificationDto { Status = "verified" },
            Bank    = new SectionVerificationDto { Status = "verified" }
        };
        var result = await controller.SaveVerificationDraft(10, dto, CancellationToken.None);

        var badReq = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal(StatusCodes.Status400BadRequest, badReq.StatusCode);
    }

    [Fact]
    public async Task SaveVerificationDraft_PersistsSectionVerificationsJson_WhenValid()
    {
        using var db = CreateInMemoryDbContext(Guid.NewGuid().ToString());
        var kyc = new InvestorKyc { Id = 11, CompanyId = 1, InvestorId = 201, Status = KycStatus.PendingReview, SubmittedAt = DateTime.UtcNow };
        db.InvestorKycs.Add(kyc);
        await db.SaveChangesAsync();

        var controller = new IrmKycController(Mock.Of<IKycService>(), Mock.Of<IOtpService>(), db);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = CreateClaimsPrincipal(5, 1, "irm", hasKycVerify: true) }
        };

        var dto = new SaveVerificationDraftDto
        {
            Aadhaar = new SectionVerificationDto { Status = "verified" },
            Pan     = new SectionVerificationDto { Status = "wrong", Reason = "Name mismatch on PAN card" },
            Bank    = new SectionVerificationDto { Status = "verified" }
        };
        var result = await controller.SaveVerificationDraft(11, dto, CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);

        // KycStatus must NOT be changed by this endpoint
        var savedKyc = await db.InvestorKycs.FindAsync(11);
        Assert.NotNull(savedKyc);
        Assert.Equal(KycStatus.PendingReview, savedKyc.Status);

        // SectionVerificationsJson must be populated
        Assert.NotNull(savedKyc.SectionVerificationsJson);
        Assert.Contains("pan", savedKyc.SectionVerificationsJson);
        Assert.Contains("wrong", savedKyc.SectionVerificationsJson);

        // Audit log must be written
        var auditEntry = await db.AuditLogs.FirstOrDefaultAsync(a => a.EntityId == "11");
        Assert.NotNull(auditEntry);
        Assert.Equal("irm_officer@ghl.com", auditEntry.ActorEmail);
    }
}
