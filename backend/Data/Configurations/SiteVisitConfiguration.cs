using backend.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace backend.Data.Configurations;

public class SiteVisitConfiguration : IEntityTypeConfiguration<SiteVisit>
{
    public void Configure(EntityTypeBuilder<SiteVisit> builder)
    {
        builder.ToTable("site_visits");

        builder.HasKey(sv => sv.Id);

        builder.Property(sv => sv.CustomerName)
            .HasMaxLength(150)
            .IsRequired();

        builder.Property(sv => sv.CustomerPhone)
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(sv => sv.ContactType)
            .HasMaxLength(50);

        builder.Property(sv => sv.ProjectName)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(sv => sv.PlotNumber)
            .HasMaxLength(100);

        builder.Property(sv => sv.ScheduledAt)
            .HasMaxLength(150)
            .IsRequired();

        builder.Property(sv => sv.AssignedAgentName)
            .HasMaxLength(150);

        builder.Property(sv => sv.Status)
            .HasMaxLength(50)
            .HasDefaultValue("Pending");

        builder.Property(sv => sv.VisitorNote)
            .HasMaxLength(2000);

        builder.Property(sv => sv.OutcomeNotes)
            .HasMaxLength(2000);

        builder.Property(sv => sv.CreatedAt)
            .HasDefaultValueSql("NOW()");

        // Indexes
        builder.HasIndex(sv => new { sv.TenantId, sv.Status });
        builder.HasIndex(sv => sv.LeadId);
        builder.HasIndex(sv => sv.CustomerId);

        // Relationships
        builder.HasOne(sv => sv.Tenant)
            .WithMany(t => t.SiteVisits)
            .HasForeignKey(sv => sv.TenantId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(sv => sv.Lead)
            .WithMany(l => l.SiteVisits)
            .HasForeignKey(sv => sv.LeadId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(sv => sv.Customer)
            .WithMany()
            .HasForeignKey(sv => sv.CustomerId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(sv => sv.Project)
            .WithMany(p => p.SiteVisits)
            .HasForeignKey(sv => sv.ProjectId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(sv => sv.Plot)
            .WithMany(p => p.SiteVisits)
            .HasForeignKey(sv => sv.PlotId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(sv => sv.ProjectId);
        builder.HasIndex(sv => sv.PlotId);
    }
}
