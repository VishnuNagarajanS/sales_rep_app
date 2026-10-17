using backend.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace backend.Data.Configurations;

public class UserSessionConfiguration : IEntityTypeConfiguration<UserSession>
{
    public void Configure(EntityTypeBuilder<UserSession> builder)
    {
        builder.ToTable("user_sessions");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.TokenId)
            .HasMaxLength(128)
            .IsRequired();

        builder.HasIndex(s => s.TokenId)
            .IsUnique();

        builder.Property(s => s.IpAddress)
            .HasMaxLength(64);

        builder.Property(s => s.UserAgent)
            .HasMaxLength(512);

        builder.Property(s => s.Device)
            .HasMaxLength(128);

        builder.Property(s => s.Location)
            .HasMaxLength(128);

        builder.Property(s => s.IsActive)
            .HasDefaultValue(true);

        builder.Property(s => s.CreatedAt)
            .HasDefaultValueSql("NOW()");

        builder.HasIndex(s => new { s.UserId, s.IsActive });

        builder.HasOne(s => s.User)
            .WithMany()
            .HasForeignKey(s => s.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
