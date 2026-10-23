using backend.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace backend.Data.Configurations;

public class JaminProjectConfiguration : IEntityTypeConfiguration<JaminProject>
{
    public void Configure(EntityTypeBuilder<JaminProject> builder)
    {
        builder.ToTable("jamin_projects");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.Name)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(p => p.Location)
            .HasMaxLength(300)
            .IsRequired();

        builder.Property(p => p.Status)
            .HasMaxLength(50)
            .HasDefaultValue("Active");

        builder.Property(p => p.Description)
            .HasMaxLength(2000);

        builder.Property(p => p.PriceRange)
            .HasMaxLength(100);

        builder.Property(p => p.ImageUrl)
            .HasColumnType("text");

        builder.Property(p => p.CreatedAt)
            .HasDefaultValueSql("NOW()");

        // Indexes
        builder.HasIndex(p => new { p.CompanyId, p.Status });

        // Relationships
        builder.HasOne(p => p.Company)
            .WithMany()
            .HasForeignKey(p => p.CompanyId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
