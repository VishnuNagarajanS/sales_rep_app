using backend.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace backend.Data.Configurations;

public class LeadConfiguration : IEntityTypeConfiguration<Lead>
{
    public void Configure(EntityTypeBuilder<Lead> builder)
    {
        builder.ToTable("leads");

        builder.HasKey(l => l.Id);

        builder.Property(l => l.Name)
            .HasMaxLength(150)
            .IsRequired();

        builder.Property(l => l.Phone)
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(l => l.Email)
            .HasMaxLength(255);

        builder.Property(l => l.Location)
            .HasMaxLength(255);

        builder.Property(l => l.Source)
            .HasMaxLength(100)
            .HasDefaultValue("Website Inbound");

        builder.Property(l => l.Status)
            .HasMaxLength(50)
            .HasDefaultValue("New");

        builder.Property(l => l.Priority)
            .HasMaxLength(50)
            .HasDefaultValue("Medium");

        builder.Property(l => l.Notes)
            .HasMaxLength(4000);

        builder.Property(l => l.CreatedAt)
            .HasDefaultValueSql("NOW()");

        builder.Ignore(l => l.TenantId);

        // Indexes
        builder.HasIndex(l => new { l.CompanyId, l.Phone });
        builder.HasIndex(l => l.Status);

        // Relationships
        builder.HasOne(l => l.Company)
            .WithMany(t => t.Leads)
            .HasForeignKey(l => l.CompanyId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(l => l.AssignedAgent)
            .WithMany()
            .HasForeignKey(l => l.AssignedAgentId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
