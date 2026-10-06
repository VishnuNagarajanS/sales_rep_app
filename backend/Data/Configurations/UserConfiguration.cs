using backend.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace backend.Data.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("users");

        builder.HasKey(u => u.Id);

        builder.Property(u => u.Name)
            .HasMaxLength(150)
            .IsRequired();

        builder.Property(u => u.Email)
            .HasMaxLength(255)
            .IsRequired();

        builder.HasIndex(u => u.Email)
            .IsUnique();

        builder.Property(u => u.PasswordHash)
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(u => u.Phone)
            .HasMaxLength(50);

        builder.Property(u => u.Status)
            .HasConversion<string>()
            .HasMaxLength(50)
            .HasDefaultValue(Models.Enums.UserStatus.Active);

        builder.Property(u => u.AvatarUrl)
            .HasMaxLength(512);

        builder.Property(u => u.CreatedAt)
            .HasDefaultValueSql("NOW()");

        builder.Property(u => u.IsProtected)
            .HasDefaultValue(false);

        builder.Property(u => u.IsTwoFactorEnabled)
            .HasDefaultValue(false);

        builder.Property(u => u.TwoFactorSecret)
            .HasMaxLength(128);

        builder.Property(u => u.TwoFactorRecoveryCodesJson)
            .HasColumnType("text");

        // Relationships
        builder.HasOne(u => u.Role)
            .WithMany(r => r.Users)
            .HasForeignKey(u => u.RoleId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(u => u.Company)
            .WithMany(t => t.Users)
            .HasForeignKey(u => u.CompanyId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(u => u.CompanyId);
        builder.HasIndex(u => u.RoleId);
    }
}
