using backend.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace backend.Data.Configurations;

public class CallRecordConfiguration : IEntityTypeConfiguration<CallRecord>
{
    public void Configure(EntityTypeBuilder<CallRecord> builder)
    {
        builder.ToTable("call_records");

        builder.HasKey(cr => cr.Id);

        builder.Property(cr => cr.ContactName)
            .HasMaxLength(150);

        builder.Property(cr => cr.ContactPhone)
            .HasMaxLength(50);

        builder.Property(cr => cr.Direction)
            .HasMaxLength(50)
            .HasDefaultValue("outbound");

        builder.Property(cr => cr.Disposition)
            .HasMaxLength(100);

        builder.Property(cr => cr.CreatedAt)
            .HasDefaultValueSql("NOW()");

        // Relationships
        builder.HasOne(cr => cr.Company)
            .WithMany()
            .HasForeignKey(cr => cr.CompanyId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(cr => cr.Agent)
            .WithMany()
            .HasForeignKey(cr => cr.AgentId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<Lead>()
            .WithMany()
            .HasForeignKey(cr => cr.LeadId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne<Customer>()
            .WithMany()
            .HasForeignKey(cr => cr.CustomerId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
