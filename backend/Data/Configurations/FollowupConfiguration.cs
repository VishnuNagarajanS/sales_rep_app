using backend.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace backend.Data.Configurations;

public class FollowupConfiguration : IEntityTypeConfiguration<Followup>
{
    public void Configure(EntityTypeBuilder<Followup> builder)
    {
        builder.ToTable("followups");

        builder.HasKey(f => f.Id);

        builder.Property(f => f.ContactId)
            .HasMaxLength(100);

        builder.Property(f => f.ContactType)
            .HasMaxLength(50)
            .HasDefaultValue("lead");

        builder.Property(f => f.ContactName)
            .HasMaxLength(150)
            .IsRequired();

        builder.Property(f => f.ContactPhone)
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(f => f.Priority)
            .HasMaxLength(50)
            .HasDefaultValue("Medium");

        builder.Property(f => f.Status)
            .HasMaxLength(50)
            .HasDefaultValue("Pending");

        builder.Property(f => f.CreatedAt)
            .HasDefaultValueSql("NOW()");

        // Relationships
        builder.HasOne(f => f.Company)
            .WithMany()
            .HasForeignKey(f => f.CompanyId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(f => f.AssignedAgent)
            .WithMany()
            .HasForeignKey(f => f.AssignedAgentId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
