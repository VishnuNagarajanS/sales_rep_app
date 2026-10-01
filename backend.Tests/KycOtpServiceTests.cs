using backend.DTOs.Irm;
using backend.Models.Entities;
using backend.Repositories.Interfaces;
using backend.Services.Implementations;
using backend.Services.Interfaces;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace backend.Tests;

public class KycOtpServiceTests
{
    private readonly IMemoryCache _cache;
    private readonly Mock<IKycRepository> _kycRepoMock;
    private readonly Mock<IEmailService> _emailServiceMock;
    private readonly Mock<ILogger<OtpService>> _loggerMock;
    private readonly OtpService _otpService;

    public KycOtpServiceTests()
    {
        _cache = new MemoryCache(new MemoryCacheOptions());
        _kycRepoMock = new Mock<IKycRepository>();
        _emailServiceMock = new Mock<IEmailService>();
        _loggerMock = new Mock<ILogger<OtpService>>();

        _otpService = new OtpService(
            _cache,
            _kycRepoMock.Object,
            _emailServiceMock.Object,
            _loggerMock.Object);
    }

    [Fact]
    public async Task SendKycOtp_UsesRegisteredEmailFromToken_AndDeliversOtp()
    {
        // Arrange
        var token = "tok_test1234_investor";
        var kyc = new InvestorKyc
        {
            Id = 1,
            InvestorName = "Sunita Rao",
            Email = "sunita.rao@example.com",
            KycLinkToken = "test1234abcd5678",
            KycLinkExpiresAt = DateTime.UtcNow.AddDays(2)
        };

        _kycRepoMock.Setup(r => r.GetByTokenAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(kyc);

        string? capturedOtp = null;
        _emailServiceMock.Setup(e => e.SendKycOtpEmailAsync(
                "sunita.rao@example.com",
                "Sunita Rao",
                It.IsAny<string>(),
                5,
                It.IsAny<CancellationToken>()))
            .Callback<string, string, string, int, CancellationToken>((to, name, otp, exp, ct) => capturedOtp = otp)
            .ReturnsAsync(true);

        // Act - Request without providing email explicitly in DTO; should resolve from registered KYC record
        var request = new SendKycOtpRequestDto { Token = token, Email = null };
        var response = await _otpService.SendKycOtpAsync(request);

        // Assert
        Assert.True(response.Success);
        Assert.NotNull(response.Data);
        Assert.True(response.Data.Success);
        Assert.Contains("s***o@example.com", response.Data.MaskedEmail);
        Assert.NotNull(capturedOtp);
        Assert.Equal(6, capturedOtp.Length);
        Assert.True(int.TryParse(capturedOtp, out _)); // Valid 6-digit numeric OTP

        _emailServiceMock.Verify(e => e.SendKycOtpEmailAsync(
            "sunita.rao@example.com",
            "Sunita Rao",
            It.IsAny<string>(),
            5,
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SendKycOtp_EmailDeliveryFailure_ReturnsErrorResponse_DoesNotClaimSuccess()
    {
        // Arrange
        var token = "tok_failed_email_test";
        var kyc = new InvestorKyc
        {
            Id = 2,
            InvestorName = "Rohan Verma",
            Email = "rohan@example.com",
            KycLinkToken = "failedtoken1234",
            KycLinkExpiresAt = DateTime.UtcNow.AddDays(2)
        };

        _kycRepoMock.Setup(r => r.GetByTokenAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(kyc);

        _emailServiceMock.SetupGet(e => e.LastError).Returns("SMTP connection refused: smtp.gmail.com:587");
        _emailServiceMock.Setup(e => e.SendKycOtpEmailAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<int>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(false); // Delivery failed!

        // Act
        var request = new SendKycOtpRequestDto { Token = token };
        var response = await _otpService.SendKycOtpAsync(request);

        // Assert
        Assert.False(response.Success);
        Assert.Contains("Failed to deliver", response.Message);
        Assert.Contains("SMTP connection refused", response.Message);

        // Verify that OTP verification fails because the un-delivered OTP was not left in cache
        var verifyRes = await _otpService.VerifyKycOtpAsync(new VerifyKycOtpRequestDto
        {
            Token = token,
            Otp = "123456"
        });
        Assert.False(verifyRes.Success);
    }

    [Fact]
    public async Task SendKycOtp_MissingRegisteredEmail_ReturnsErrorResponse_DoesNotSend()
    {
        // Arrange
        var token = "tok_no_email_record";
        var kyc = new InvestorKyc
        {
            Id = 3,
            InvestorName = "Investor Without Email",
            Email = "", // Missing email on file
            KycLinkToken = "noemailtoken1234",
            KycLinkExpiresAt = DateTime.UtcNow.AddDays(2)
        };

        _kycRepoMock.Setup(r => r.GetByTokenAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(kyc);

        // Act
        var request = new SendKycOtpRequestDto { Token = token, Email = "" };
        var response = await _otpService.SendKycOtpAsync(request);

        // Assert
        Assert.False(response.Success);
        Assert.Contains("No registered email address is associated", response.Message);

        _emailServiceMock.Verify(e => e.SendKycOtpEmailAsync(
            It.IsAny<string>(),
            It.IsAny<string>(),
            It.IsAny<string>(),
            It.IsAny<int>(),
            It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task SendKycOtp_InvalidToken_ReturnsErrorResponse()
    {
        // Arrange
        _kycRepoMock.Setup(r => r.GetByTokenAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((InvestorKyc?)null);

        // Act
        var request = new SendKycOtpRequestDto { Token = "tok_nonexistent_or_expired" };
        var response = await _otpService.SendKycOtpAsync(request);

        // Assert
        Assert.False(response.Success);
        Assert.Contains("Invalid or expired KYC token", response.Message);
    }

    [Fact]
    public async Task ResendOtp_GeneratesNewOtp_AndInvalidatesPreviousOtp()
    {
        // Arrange
        var token = "tok_resend_test_12345";
        var kyc = new InvestorKyc
        {
            Id = 4,
            InvestorName = "Ananya Iyer",
            Email = "ananya.iyer@example.com",
            KycLinkToken = "resendtest123456",
            KycLinkExpiresAt = DateTime.UtcNow.AddDays(2)
        };

        _kycRepoMock.Setup(r => r.GetByTokenAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(kyc);

        var sentOtps = new List<string>();
        _emailServiceMock.Setup(e => e.SendKycOtpEmailAsync(
                "ananya.iyer@example.com",
                "Ananya Iyer",
                It.IsAny<string>(),
                5,
                It.IsAny<CancellationToken>()))
            .Callback<string, string, string, int, CancellationToken>((to, name, otp, exp, ct) => sentOtps.Add(otp))
            .ReturnsAsync(true);

        // 1. Initial send
        var res1 = await _otpService.SendKycOtpAsync(new SendKycOtpRequestDto { Token = token });
        Assert.True(res1.Success);
        Assert.Single(sentOtps);
        var firstOtp = sentOtps[0];

        // 2. Resend
        var res2 = await _otpService.SendKycOtpAsync(new SendKycOtpRequestDto { Token = token });
        Assert.True(res2.Success);
        Assert.Equal(2, sentOtps.Count);
        var secondOtp = sentOtps[1];

        // 3. Trying to verify the old (first) OTP should fail because resend invalidated it
        var verifyOld = await _otpService.VerifyKycOtpAsync(new VerifyKycOtpRequestDto
        {
            Token = token,
            Otp = firstOtp
        });

        if (firstOtp != secondOtp)
        {
            Assert.False(verifyOld.Success);
            Assert.Contains("Invalid verification code", verifyOld.Message);
        }

        // 4. Verifying the new (second) OTP should succeed
        var verifyNew = await _otpService.VerifyKycOtpAsync(new VerifyKycOtpRequestDto
        {
            Token = token,
            Otp = secondOtp
        });
        Assert.True(verifyNew.Success);
        Assert.True(verifyNew.Data?.Verified);
        Assert.Equal("ananya.iyer@example.com", verifyNew.Data?.Email);

        // 5. Subsequent verification of the same second OTP should fail because it was invalidated upon success
        var verifyReuse = await _otpService.VerifyKycOtpAsync(new VerifyKycOtpRequestDto
        {
            Token = token,
            Otp = secondOtp
        });
        Assert.False(verifyReuse.Success);
    }
}
