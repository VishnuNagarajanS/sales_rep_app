using backend.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace backend.Data.Configurations;

public class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> builder)
    {
        builder.ToTable("AuditLogs");

        builder.HasKey(a => a.Id);

        builder.Property(a => a.ActorName)
            .HasMaxLength(150);

        builder.Property(a => a.ActorEmail)
            .HasMaxLength(255);

        builder.Property(a => a.Action)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(a => a.EntityType)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(a => a.EntityId)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(a => a.Details)
            .HasMaxLength(4000);

        builder.Property(a => a.Status)
            .HasMaxLength(50)
            .HasDefaultValue("success");

        builder.Property(a => a.Timestamp)
            .HasDefaultValueSql("NOW()");

        // Relationships
        builder.HasOne(a => a.Company)
            .WithMany()
            .HasForeignKey(a => a.CompanyId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(a => a.Lead)
            .WithMany(l => l.AuditLogs)
            .HasForeignKey(a => a.LeadId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(a => a.Customer)
            .WithMany(c => c.AuditLogs)
            .HasForeignKey(a => a.CustomerId)
            .OnDelete(DeleteBehavior.SetNull);

        // Indexes
        builder.HasIndex(a => a.LeadId);
        builder.HasIndex(a => a.CustomerId);
        builder.HasIndex(a => a.CompanyId);
        builder.HasIndex(a => a.Timestamp);
        builder.HasIndex(a => a.EntityType);
    }
}
