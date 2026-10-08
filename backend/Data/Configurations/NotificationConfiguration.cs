using backend.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace backend.Data.Configurations;

public class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> builder)
    {
        builder.ToTable("Notifications");

        builder.HasKey(n => n.Id);

        builder.Property(n => n.Title)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(n => n.Message)
            .HasMaxLength(2000)
            .IsRequired();

        builder.Property(n => n.Type)
            .HasMaxLength(50)
            .HasDefaultValue("info");

        builder.Property(n => n.CreatedAt)
            .HasDefaultValueSql("NOW()");

        // Relationships with Lead and Customer
        builder.HasOne(n => n.Lead)
            .WithMany(l => l.Notifications)
            .HasForeignKey(n => n.LeadId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(n => n.Customer)
            .WithMany(c => c.Notifications)
            .HasForeignKey(n => n.CustomerId)
            .OnDelete(DeleteBehavior.SetNull);

        // Indexes
        builder.HasIndex(n => n.LeadId);
        builder.HasIndex(n => n.CustomerId);
        builder.HasIndex(n => new { n.CompanyId, n.UserId });
    }
}
