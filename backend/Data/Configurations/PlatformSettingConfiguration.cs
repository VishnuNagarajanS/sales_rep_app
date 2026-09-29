using backend.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace backend.Data.Configurations;

public class PlatformSettingConfiguration : IEntityTypeConfiguration<PlatformSetting>
{
    public void Configure(EntityTypeBuilder<PlatformSetting> builder)
    {
        builder.ToTable("platform_settings");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.MaintenanceModeEnabled)
            .HasDefaultValue(false);

        builder.Property(s => s.MaintenanceMessage)
            .HasMaxLength(512)
            .HasDefaultValue("Platform under scheduled maintenance.");

        builder.Property(s => s.BypassSecret)
            .HasMaxLength(128)
            .HasDefaultValue("nexus-admin-2026");

        builder.Property(s => s.UpdatedAt)
            .HasDefaultValueSql("NOW()");
    }
}
