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

        builder.HasIndex(d => d.PhoneNumber);

        builder.Property(d => d.RoutingStrategy)
            .HasMaxLength(64)
            .HasDefaultValue("Round-Robin");

        builder.Property(d => d.QueueName)
            .HasMaxLength(128)
            .HasDefaultValue("Inbound Sales Queue");

        builder.Property(d => d.Status)
            .HasMaxLength(32)
            .HasDefaultValue("Online");

        builder.Property(d => d.ChannelsCount)
            .HasDefaultValue(8);

        builder.Property(d => d.Notes)
            .HasMaxLength(512);

        builder.Property(d => d.AllocatedAt)
            .HasDefaultValueSql("NOW()");

        builder.Property(d => d.CreatedAt)
            .HasDefaultValueSql("NOW()");

        builder.HasOne(d => d.Tenant)
            .WithMany(t => t.DidMappings)
            .HasForeignKey(d => d.TenantId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
