using backend.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace backend.Data.Configurations;

public class UserMfaSettingConfiguration : IEntityTypeConfiguration<UserMfaSetting>
{
    public void Configure(EntityTypeBuilder<UserMfaSetting> builder)
    {
        builder.ToTable("user_mfa_settings");

        builder.HasKey(s => s.Id);

        builder.HasIndex(s => s.UserId)
            .IsUnique();

        builder.Property(s => s.SecretEncrypted)
            .HasMaxLength(512)
            .IsRequired();

        builder.Property(s => s.PendingSecretEncrypted)
            .HasMaxLength(512);

        builder.Property(s => s.IsEnabled)
            .HasDefaultValue(false);

        builder.Property(s => s.FailedAttempts)
            .HasDefaultValue(0);

        builder.Property(s => s.CreatedAt)
            .HasDefaultValueSql("NOW()");

        builder.HasOne(s => s.User)
            .WithOne()
            .HasForeignKey<UserMfaSetting>(s => s.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
