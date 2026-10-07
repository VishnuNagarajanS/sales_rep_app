using backend.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace backend.Data.Configurations;

public class SecurityEventConfiguration : IEntityTypeConfiguration<SecurityEvent>
{
    public void Configure(EntityTypeBuilder<SecurityEvent> builder)
    {
        builder.ToTable("security_events");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.EventType)
            .HasMaxLength(64)
            .IsRequired();

        builder.Property(e => e.ActorEmail)
            .HasMaxLength(255);

        builder.Property(e => e.IpAddress)
            .HasMaxLength(64);

        builder.Property(e => e.UserAgent)
            .HasMaxLength(512);

        builder.Property(e => e.Severity)
            .HasMaxLength(32)
            .HasDefaultValue("info");

        builder.Property(e => e.CreatedAt)
            .HasDefaultValueSql("NOW()");

        builder.HasIndex(e => new { e.CreatedAt, e.Severity });
        builder.HasIndex(e => e.EventType);

        builder.HasOne(e => e.User)
            .WithMany()
            .HasForeignKey(e => e.UserId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
