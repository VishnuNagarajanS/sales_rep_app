using backend.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace backend.Data.Configurations;

public class MfaChallengeConfiguration : IEntityTypeConfiguration<MfaChallenge>
{
    public void Configure(EntityTypeBuilder<MfaChallenge> builder)
    {
        builder.ToTable("mfa_challenges");

        builder.HasKey(c => c.Id);

        builder.HasIndex(c => c.ChallengeTokenHash)
            .IsUnique();

        builder.HasIndex(c => new { c.UserId, c.ExpiresAt });

        builder.Property(c => c.ChallengeTokenHash)
            .HasMaxLength(128)
            .IsRequired();

        builder.Property(c => c.AttemptCount)
            .HasDefaultValue(0);

        builder.Property(c => c.IpAddress)
            .HasMaxLength(64);

        builder.Property(c => c.UserAgent)
            .HasMaxLength(512);

        builder.Property(c => c.CreatedAt)
            .HasDefaultValueSql("NOW()");

        builder.HasOne(c => c.User)
            .WithMany()
            .HasForeignKey(c => c.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
