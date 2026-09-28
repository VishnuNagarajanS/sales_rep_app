using backend.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace backend.Data.Configurations;

public class ConsultationConfiguration : IEntityTypeConfiguration<Consultation>
{
    public void Configure(EntityTypeBuilder<Consultation> builder)
    {
        builder.ToTable("consultations");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.InvestorId)
            .HasMaxLength(100);

        builder.Property(c => c.InvestorName)
            .HasMaxLength(150)
            .IsRequired();

        builder.Property(c => c.InvestorPhone)
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(c => c.Status)
            .HasMaxLength(50)
            .HasDefaultValue("Scheduled");

        builder.Property(c => c.CreatedAt)
            .HasDefaultValueSql("NOW()");

        // Relationships
        builder.HasOne(c => c.Company)
            .WithMany()
            .HasForeignKey(c => c.CompanyId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(c => c.Consultant)
            .WithMany()
            .HasForeignKey(c => c.ConsultantId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
