using backend.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace backend.Data.Configurations;

public class WorkHandoverConfiguration : IEntityTypeConfiguration<WorkHandover>
{
    public void Configure(EntityTypeBuilder<WorkHandover> builder)
    {
        builder.ToTable("work_handovers");

        builder.HasKey(h => h.Id);

        builder.Property(h => h.RoleCode)
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(h => h.Reason)
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(h => h.Status)
            .HasMaxLength(50)
            .HasDefaultValue("active")
            .IsRequired();

        builder.Property(h => h.StartedAt)
            .HasDefaultValueSql("NOW()");

        builder.HasOne(h => h.Company)
            .WithMany()
            .HasForeignKey(h => h.CompanyId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(h => h.OriginalUser)
            .WithMany()
            .HasForeignKey(h => h.OriginalUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(h => h.CoveringUser)
            .WithMany()
            .HasForeignKey(h => h.CoveringUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(h => h.StartedBy)
            .WithMany()
            .HasForeignKey(h => h.StartedById)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(h => h.EndedBy)
            .WithMany()
            .HasForeignKey(h => h.EndedById)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(h => h.Items)
            .WithOne(i => i.Handover)
            .HasForeignKey(i => i.HandoverId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(h => new { h.CompanyId, h.RoleCode, h.Status });
        builder.HasIndex(h => new { h.CompanyId, h.OriginalUserId, h.Status });
        builder.HasIndex(h => new { h.CompanyId, h.CoveringUserId, h.Status });
    }
}
