using backend.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace backend.Data.Configurations;

public class PlatformCarrierSettingsConfiguration : IEntityTypeConfiguration<PlatformCarrierSettings>
{
    public void Configure(EntityTypeBuilder<PlatformCarrierSettings> builder)
    {
        builder.ToTable("platform_carrier_settings");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.PrimaryCarrier)
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(c => c.SecondaryCarrier)
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(c => c.SipRealm)
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(c => c.WebRtcGatewayUrl)
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(c => c.RecordingRetentionDays)
            .HasDefaultValue(180);

        builder.Property(c => c.MaxConcurrentChannels)
            .HasDefaultValue(100);

        builder.Property(c => c.EmergencyRoutingEnabled)
            .HasDefaultValue(true);

        builder.Property(c => c.WhisperAiModel)
            .HasMaxLength(255);

        builder.Property(c => c.TestStatus)
            .HasMaxLength(64);

        builder.Property(c => c.UpdatedAt)
            .HasDefaultValueSql("NOW()");
    }
}
