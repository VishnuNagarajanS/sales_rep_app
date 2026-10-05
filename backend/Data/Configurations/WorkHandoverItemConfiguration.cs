using backend.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace backend.Data.Configurations;

public class WorkHandoverItemConfiguration : IEntityTypeConfiguration<WorkHandoverItem>
{
    public void Configure(EntityTypeBuilder<WorkHandoverItem> builder)
    {
        builder.ToTable("work_handover_items");

        builder.HasKey(i => i.Id);

        builder.Property(i => i.EntityType)
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(i => i.Origin)
            .HasMaxLength(50)
            .HasDefaultValue("included_at_start")
            .IsRequired();

        builder.Property(i => i.ReturnOutcome)
            .HasMaxLength(50);

        builder.Property(i => i.CreatedAt)
            .HasDefaultValueSql("NOW()");

        builder.HasOne(i => i.Handover)
            .WithMany(h => h.Items)
            .HasForeignKey(i => i.HandoverId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(i => new { i.HandoverId, i.EntityType, i.EntityId });
    }
}
