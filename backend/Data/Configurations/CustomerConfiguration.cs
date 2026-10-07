using backend.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace backend.Data.Configurations;

public class CustomerConfiguration : IEntityTypeConfiguration<Customer>
{
    public void Configure(EntityTypeBuilder<Customer> builder)
    {
        builder.ToTable("customers");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Name)
            .HasMaxLength(150)
            .IsRequired();

        builder.Property(c => c.Phone)
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(c => c.Email)
            .HasMaxLength(255);

        builder.Property(c => c.NormalizedPhone)
            .HasMaxLength(20);

        builder.Property(c => c.NormalizedEmail)
            .HasMaxLength(255);

        builder.Property(c => c.IsDuplicate)
            .HasDefaultValue(false);

        builder.Property(c => c.Location)
            .HasMaxLength(255);

        builder.Property(c => c.Status)
            .HasMaxLength(50)
            .HasDefaultValue("Active");

        builder.Property(c => c.TotalValue)
            .HasColumnType("numeric(18,2)")
            .HasDefaultValue(0);

        builder.Property(c => c.CreatedAt)
            .HasDefaultValueSql("NOW()");

        // Tenant-scoped filtered unique indexes on normalized identifiers (safe when existing duplicates exist)
        builder.HasIndex(c => new { c.CompanyId, c.NormalizedPhone })
            .HasFilter("\"IsDuplicate\" = false AND \"NormalizedPhone\" IS NOT NULL AND \"NormalizedPhone\" <> ''")
            .IsUnique();

        builder.HasIndex(c => new { c.CompanyId, c.NormalizedEmail })
            .HasFilter("\"IsDuplicate\" = false AND \"NormalizedEmail\" IS NOT NULL AND \"NormalizedEmail\" <> ''")
            .IsUnique();

        // Relationships
        builder.HasOne(c => c.Company)
            .WithMany()
            .HasForeignKey(c => c.CompanyId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(c => c.AssignedAgent)
            .WithMany()
            .HasForeignKey(c => c.AssignedAgentId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
