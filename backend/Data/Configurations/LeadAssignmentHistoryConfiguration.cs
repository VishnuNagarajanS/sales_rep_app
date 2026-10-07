using backend.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace backend.Data.Configurations;

public class LeadAssignmentHistoryConfiguration : IEntityTypeConfiguration<LeadAssignmentHistory>
{
    public void Configure(EntityTypeBuilder<LeadAssignmentHistory> builder)
    {
        builder.ToTable("lead_assignment_history");

        builder.HasKey(h => h.Id);

        builder.HasOne(h => h.Lead)
            .WithMany()
            .HasForeignKey(h => h.LeadId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(h => h.FromAgent)
            .WithMany()
            .HasForeignKey(h => h.FromAgentId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(h => h.ToAgent)
            .WithMany()
            .HasForeignKey(h => h.ToAgentId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(h => h.AssignedBy)
            .WithMany()
            .HasForeignKey(h => h.AssignedById)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
