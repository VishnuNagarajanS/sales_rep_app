using backend.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace backend.Data.Configurations;

public class JaminPlotConfiguration : IEntityTypeConfiguration<JaminPlot>
{
    public void Configure(EntityTypeBuilder<JaminPlot> builder)
    {
        builder.ToTable("jamin_plots");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.PlotNumber)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(p => p.Dimensions)
            .HasMaxLength(50);

        builder.Property(p => p.Facing)
            .HasMaxLength(50);

        builder.Property(p => p.Status)
            .HasMaxLength(50)
            .HasDefaultValue("Available");

        builder.Property(p => p.Price)
            .HasPrecision(18, 2);

        builder.Property(p => p.PricePerSqft)
            .HasPrecision(18, 2);

        builder.Property(p => p.HeldByCustomerName)
            .HasMaxLength(150);

        builder.Property(p => p.HeldByCustomerPhone)
            .HasMaxLength(50);

        builder.Property(p => p.HoldByAgent)
            .HasMaxLength(150);

        builder.Property(p => p.Notes)
            .HasMaxLength(2000);

        builder.Property(p => p.CreatedAt)
            .HasDefaultValueSql("NOW()");

        // Indexes
        builder.HasIndex(p => new { p.CompanyId, p.ProjectId, p.Status });
        builder.HasIndex(p => new { p.ProjectId, p.PlotNumber }).IsUnique();

        // Relationships
        builder.HasOne(p => p.Company)
            .WithMany()
            .HasForeignKey(p => p.CompanyId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(p => p.Project)
            .WithMany(pr => pr.Plots)
            .HasForeignKey(p => p.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
