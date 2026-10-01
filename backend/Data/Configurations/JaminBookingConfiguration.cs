using backend.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace backend.Data.Configurations;

public class JaminBookingConfiguration : IEntityTypeConfiguration<JaminBooking>
{
    public void Configure(EntityTypeBuilder<JaminBooking> builder)
    {
        builder.ToTable("jamin_bookings");
    
        builder.HasKey(b => b.Id);

        builder.Property(b => b.CustomerName)
            .HasMaxLength(150)
            .IsRequired();

        builder.Property(b => b.CustomerPhone)
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(b => b.ProjectName)
            .HasMaxLength(200);

        builder.Property(b => b.PlotNumber)
            .HasMaxLength(100);

        builder.Property(b => b.TotalPlotPrice)
            .HasPrecision(18, 2);

        builder.Property(b => b.TokenAmountPaid)
            .HasPrecision(18, 2);

        builder.Property(b => b.PaymentMode)
            .HasMaxLength(100);

        builder.Property(b => b.PaymentTerms)
            .HasMaxLength(500);

        builder.Property(b => b.Status)
            .HasMaxLength(50)
            .HasDefaultValue("Token Paid");

        builder.Property(b => b.AssignedAgentName)
            .HasMaxLength(150);

        builder.Property(b => b.Notes)
            .HasMaxLength(2000);

        builder.Property(b => b.CreatedAt)
            .HasDefaultValueSql("NOW()");

        // Indexes
        builder.HasIndex(b => new { b.CompanyId, b.Status });
        builder.HasIndex(b => b.CustomerPhone);
        builder.HasIndex(b => b.CustomerId);

        // Relationships
        builder.HasOne(b => b.Company)
            .WithMany()
            .HasForeignKey(b => b.CompanyId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(b => b.Customer)
            .WithMany()
            .HasForeignKey(b => b.CustomerId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(b => b.Project)
            .WithMany(p => p.Bookings)
            .HasForeignKey(b => b.ProjectId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(b => b.Plot)
            .WithMany(p => p.Bookings)
            .HasForeignKey(b => b.PlotId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(b => b.AssignedAgent)
            .WithMany()
            .HasForeignKey(b => b.AssignedAgentId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
