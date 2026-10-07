using backend.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace backend.Data.Configurations;

public class BroadcastAnnouncementConfiguration : IEntityTypeConfiguration<BroadcastAnnouncement>
{
    public void Configure(EntityTypeBuilder<BroadcastAnnouncement> builder)
    {
        builder.ToTable("broadcast_announcements");

        builder.HasKey(a => a.Id);

        builder.Property(a => a.Title)
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(a => a.Message)
            .HasMaxLength(2000)
            .IsRequired();

        builder.Property(a => a.Priority)
            .HasMaxLength(32)
            .HasDefaultValue("info");

        builder.Property(a => a.TargetAudience)
            .HasMaxLength(32)
            .HasDefaultValue("all");

        builder.Property(a => a.CreatedBy)
            .HasMaxLength(100)
            .HasDefaultValue("Super Admin");

        builder.Property(a => a.IsActive)
            .HasDefaultValue(true);

        builder.Property(a => a.CreatedAt)
            .HasDefaultValueSql("NOW()");

        builder.HasOne(a => a.TargetTenant)
            .WithMany()
            .HasForeignKey(a => a.TargetTenantId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(a => a.IsActive)
            .HasDatabaseName("ux_broadcast_announcements_single_active_global")
            .IsUnique()
            .HasFilter("\"IsActive\" = TRUE AND \"TargetTenantId\" IS NULL");
    }
}
