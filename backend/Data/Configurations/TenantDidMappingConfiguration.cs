using backend.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace backend.Data.Configurations;

public class TenantDidMappingConfiguration : IEntityTypeConfiguration<TenantDidMapping>
{
    public void Configure(EntityTypeBuilder<TenantDidMapping> builder)
    {
        builder.ToTable("tenant_did_mappings");

        builder.HasKey(d => d.Id);

        builder.Property(d => d.PhoneNumber)
            .HasMaxLength(64)
            .IsRequired();

        builder.HasIndex(d => d.PhoneNumber)
            .IsUnique();

        builder.Property(d => d.RoutingStrategy)
            .HasMaxLength(64)
            .HasDefaultValue("Round-Robin");

        builder.Property(d => d.QueueName)
            .HasMaxLength(128)
            .HasDefaultValue("Inbound Queue");

        builder.Property(d => d.EnableRecording)
            .HasDefaultValue(true);

        builder.Property(d => d.EnableAiWhisper)
            .HasDefaultValue(true);

        builder.Property(d => d.Status)
            .HasMaxLength(32)
            .HasDefaultValue("Online");

        builder.Property(d => d.ChannelsCount)
            .HasDefaultValue(8);

        builder.Property(d => d.Notes)
            .HasMaxLength(512);

        builder.Property(d => d.AllocatedAt)
            .HasDefaultValueSql("NOW()");

        builder.HasOne(d => d.Tenant)
            .WithMany()
            .HasForeignKey(d => d.TenantId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
