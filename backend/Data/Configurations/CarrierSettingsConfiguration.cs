using backend.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace backend.Data.Configurations;

public class CarrierSettingsConfiguration : IEntityTypeConfiguration<CarrierSettings>
{
    public void Configure(EntityTypeBuilder<CarrierSettings> builder)
    {
        builder.ToTable("carrier_settings");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.PrimaryCarrier)
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(c => c.SecondaryCarrier)
            .HasMaxLength(255);

        builder.Property(c => c.SipRealm)
            .HasMaxLength(255);

        builder.Property(c => c.WebrtcGatewayUrl)
            .HasMaxLength(255);

        builder.Property(c => c.WhisperAiModel)
            .HasMaxLength(255);

        builder.Property(c => c.AccountSid)
            .HasMaxLength(128);

        builder.Property(c => c.AuthTokenEncrypted)
            .HasMaxLength(512);

        builder.Property(c => c.PrimaryGatewayHost)
            .HasMaxLength(255);

        builder.Property(c => c.FailoverGatewayHost)
            .HasMaxLength(255);

        builder.Property(c => c.Status)
            .HasMaxLength(50)
            .HasDefaultValue("Active");

        builder.Property(c => c.TestStatus)
            .HasMaxLength(50);

        builder.Property(c => c.UpdatedAt)
            .HasDefaultValueSql("NOW()");
    }
}
