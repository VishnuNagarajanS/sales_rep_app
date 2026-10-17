using backend.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace backend.Data.Configurations;

public class SubscriptionPackageConfiguration : IEntityTypeConfiguration<SubscriptionPackage>
{
    public void Configure(EntityTypeBuilder<SubscriptionPackage> builder)
    {
        builder.ToTable("subscription_packages");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.Name)
            .HasMaxLength(150)
            .IsRequired();

        builder.Property(p => p.Code)
            .HasMaxLength(64)
            .IsRequired();

        builder.HasIndex(p => p.Code)
            .IsUnique();

        builder.Property(p => p.Description)
            .HasMaxLength(500);

        builder.Property(p => p.Tier)
            .HasMaxLength(32)
            .HasDefaultValue("Growth");

        builder.Property(p => p.PriceMonthly)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(p => p.Currency)
            .HasMaxLength(16)
            .HasDefaultValue("₹");

        builder.Property(p => p.Features)
            .HasColumnType("text[]")
            .IsRequired();

        builder.Property(p => p.IsPopular)
            .HasDefaultValue(false);

        builder.Property(p => p.IsActive)
            .HasDefaultValue(true);

        builder.Property(p => p.CreatedAt)
            .HasDefaultValueSql("NOW()");
    }
}
