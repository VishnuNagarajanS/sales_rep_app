using backend.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace backend.Data.Configurations;

public class TenantConfiguration : IEntityTypeConfiguration<Tenant>
{
    public void Configure(EntityTypeBuilder<Tenant> builder)
    {
        builder.ToTable("tenants");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.Name)
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(t => t.Slug)
            .HasMaxLength(64)
            .IsRequired();

        builder.HasIndex(t => t.Slug)
            .IsUnique();

        builder.Property(t => t.BrandColor)
            .HasMaxLength(32)
            .HasDefaultValue("#0284c7");

        builder.Property(t => t.Logo)
            .HasMaxLength(512);

        builder.Property(t => t.Tagline)
            .HasMaxLength(512);

        builder.Property(t => t.EnabledFeatures)
            .HasColumnType("text[]")
            .IsRequired();

        builder.Property(t => t.Timezone)
            .HasMaxLength(64)
            .HasDefaultValue("Asia/Kolkata (IST)");

        builder.Property(t => t.Currency)
            .HasMaxLength(32)
            .HasDefaultValue("₹ INR");

        builder.Property(t => t.BusinessHours)
            .HasMaxLength(128)
            .HasDefaultValue("09:30 AM - 07:00 PM IST");

        builder.Property(t => t.LegalName)
            .HasMaxLength(255);

        builder.Property(t => t.Industry)
            .HasMaxLength(128);

        builder.Property(t => t.Status)
            .HasMaxLength(32)
            .HasDefaultValue("Active");

        builder.Property(t => t.SubscriptionPlan)
            .HasMaxLength(128);

        builder.Property(t => t.LeadSla)
            .HasDefaultValue(15);

        builder.Property(t => t.CallEnabled)
            .HasDefaultValue(true);

        builder.Property(t => t.RecordingEnabled)
            .HasDefaultValue(true);

        builder.Property(t => t.TranscriptionEnabled)
            .HasDefaultValue(true);

        builder.Property(t => t.IsActive)
            .HasDefaultValue(true);

        builder.Property(t => t.CreatedAt)
            .HasDefaultValueSql("NOW()");
    }
}
