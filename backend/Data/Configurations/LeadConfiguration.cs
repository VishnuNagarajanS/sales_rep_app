using backend.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace backend.Data.Configurations;

public class LeadConfiguration : IEntityTypeConfiguration<Lead>
{
    public void Configure(EntityTypeBuilder<Lead> builder)
    {
        builder.ToTable("leads");

        builder.HasKey(l => l.Id);

        builder.Property(l => l.Name)
            .HasMaxLength(150)
            .IsRequired();

        builder.Property(l => l.Phone)
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(l => l.Email)
            .HasMaxLength(255);

        builder.Property(l => l.Location)
            .HasMaxLength(255);

        builder.Property(l => l.Source)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(l => l.Status)
            .HasMaxLength(50)
            .HasDefaultValue("New");

        builder.Property(l => l.Priority)
            .HasMaxLength(50)
            .HasDefaultValue("Medium");

        builder.Property(l => l.AssignedAgentName)
            .HasMaxLength(150);

        // Website Form Intake Fields (Jamin)
        builder.Property(l => l.TargetDevelopment)
            .HasMaxLength(200);

        builder.Property(l => l.PreferredVisitDate)
            .HasMaxLength(100);

        builder.Property(l => l.PreferredTimeSlot)
            .HasMaxLength(100);

        builder.Property(l => l.AnythingWeShouldKnow)
            .HasMaxLength(2000);

        builder.Property(l => l.WhatAreYouLookingFor)
            .HasMaxLength(2000);

        builder.Property(l => l.BudgetRange)
            .HasMaxLength(100);

        // GHL Fields
        builder.Property(l => l.InvestmentCapacity)
            .HasMaxLength(100);

        builder.Property(l => l.AssetClass)
            .HasMaxLength(100);

        builder.Property(l => l.Horizon)
            .HasMaxLength(100);

        builder.Property(l => l.InvestorType)
            .HasMaxLength(100);

        builder.Property(l => l.Notes)
            .HasMaxLength(4000);

        builder.Property(l => l.CreatedAt)
            .HasDefaultValueSql("NOW()");

        // Indexes
        builder.HasIndex(l => new { l.TenantId, l.Phone });
        builder.HasIndex(l => l.Status);

        // Relationships
        builder.HasOne(l => l.Tenant)
            .WithMany(t => t.Leads)
            .HasForeignKey(l => l.TenantId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
