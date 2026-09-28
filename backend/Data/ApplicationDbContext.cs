using backend.Helpers;
using backend.Models.Entities;
using backend.Models.Enums;
using Microsoft.EntityFrameworkCore;

namespace backend.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
    {
    }

    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Lead> Leads => Set<Lead>();
    public DbSet<Followup> Followups => Set<Followup>();
    public DbSet<CallRecord> CallRecords => Set<CallRecord>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
    public DbSet<ExecutiveProfile> ExecutiveProfiles => Set<ExecutiveProfile>();
    public DbSet<Consultation> Consultations => Set<Consultation>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<CustomerKyc> CustomerKycs => Set<CustomerKyc>();
    public DbSet<KycDocument> KycDocuments => Set<KycDocument>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Apply entity configurations
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);

        // Configure Customer and KYC entities
        modelBuilder.Entity<Customer>(entity =>
        {
            entity.HasKey(c => c.Id);
            entity.Property(c => c.Name).IsRequired().HasMaxLength(150);
            entity.Property(c => c.Phone).IsRequired().HasMaxLength(50);
            entity.Property(c => c.Email).HasMaxLength(150);
            entity.Property(c => c.Status).HasMaxLength(50).HasDefaultValue("Active");
            entity.Property(c => c.KycStatus).HasMaxLength(50).HasDefaultValue("Pending");
            entity.HasIndex(c => new { c.CompanyId, c.Phone });
            entity.HasOne(c => c.AssignedToUser)
                .WithMany()
                .HasForeignKey(c => c.AssignedToUserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<CustomerKyc>(entity =>
        {
            entity.HasKey(k => k.Id);
            entity.Property(k => k.DocumentType).IsRequired().HasMaxLength(50);
            entity.Property(k => k.DocumentNumber).IsRequired().HasMaxLength(100);
            entity.Property(k => k.Status).HasMaxLength(50).HasDefaultValue("Pending");
            entity.HasIndex(k => new { k.CompanyId, k.CustomerId });
            entity.HasOne(k => k.Customer)
                .WithMany(c => c.KycRecords)
                .HasForeignKey(k => k.CustomerId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(k => k.VerifiedByUser)
                .WithMany()
                .HasForeignKey(k => k.VerifiedByUserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<KycDocument>(entity =>
        {
            entity.HasKey(d => d.Id);
            entity.Property(d => d.DocumentName).IsRequired().HasMaxLength(255);
            entity.Property(d => d.StoredFileName).IsRequired().HasMaxLength(255);
            entity.Property(d => d.StoragePath).IsRequired().HasMaxLength(500);
            entity.Property(d => d.Category).HasMaxLength(100).HasDefaultValue("KYC");
            entity.Property(d => d.Status).HasMaxLength(50).HasDefaultValue("Pending");
            entity.HasIndex(d => new { d.CompanyId, d.CustomerId });
            entity.HasOne(d => d.Customer)
                .WithMany(c => c.Documents)
                .HasForeignKey(d => d.CustomerId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(d => d.CustomerKyc)
                .WithMany(k => k.Documents)
                .HasForeignKey(d => d.CustomerKycId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(d => d.UploadedByUser)
                .WithMany()
                .HasForeignKey(d => d.UploadedByUserId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(d => d.VerifiedByUser)
                .WithMany()
                .HasForeignKey(d => d.VerifiedByUserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // Seed initial roles, tenants, demo users, and KYC demo data
        SeedData(modelBuilder);
    }

    private static void SeedData(ModelBuilder modelBuilder)
    {
        // 1. Roles (Integer IDs 1, 2, 3, 4, 5)
        var superAdminRoleId = 1;
        var companyAdminRoleId = 2;
        var salesManagerRoleId = 3;
        var salesExecutiveRoleId = 4;
        var irmRoleId = 5;

        modelBuilder.Entity<Role>().HasData(
            new Role
            {
                Id = superAdminRoleId,
                Name = "Super Admin",
                Code = "super_admin",
                Permissions = new List<string>
                {
                    "leads.view", "leads.create", "leads.update", "leads.delete", "leads.assign", "leads.export", "leads.import", "leads.convert",
                    "customers.view", "customers.create", "customers.update", "customers.delete",
                    "deals.view", "deals.create", "deals.update", "deals.delete",
                    "calls.make", "calls.receive", "calls.view", "calls.recordings.play",
                    "followups.view", "followups.create", "followups.update",
                    "properties.view", "properties.update", "site_visits.view", "site_visits.create", "bookings.view", "bookings.create",
                    "investors.view", "investors.create", "consultations.view", "consultations.create", "opportunities.view", "opportunities.create",
                    "reports.view", "reports.export",
                    "users.view", "users.manage", "roles.view", "roles.manage", "settings.view", "settings.update", "audit.view",
                    "platform.companies.manage", "platform.packages.manage", "platform.call_config.manage"
                },
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new Role
            {
                Id = companyAdminRoleId,
                Name = "Company Admin",
                Code = "company_admin",
                Permissions = new List<string>
                {
                    "leads.view", "leads.create", "leads.update", "leads.delete", "leads.assign", "leads.export", "leads.import", "leads.convert",
                    "customers.view", "customers.create", "customers.update", "customers.delete",
                    "deals.view", "deals.create", "deals.update", "deals.delete",
                    "calls.make", "calls.receive", "calls.view", "calls.recordings.play",
                    "followups.view", "followups.create", "followups.update",
                    "properties.view", "properties.update", "site_visits.view", "site_visits.create", "bookings.view", "bookings.create",
                    "investors.view", "investors.create", "consultations.view", "consultations.create", "opportunities.view", "opportunities.create",
                    "reports.view", "reports.export",
                    "users.view", "users.manage", "roles.view", "settings.view", "settings.update", "audit.view"
                },
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new Role
            {
                Id = salesManagerRoleId,
                Name = "Sales Manager",
                Code = "sales_manager",
                Permissions = new List<string>
                {
                    "leads.view", "leads.create", "leads.update", "leads.assign", "leads.export", "leads.convert",
                    "customers.view", "customers.create", "customers.update",
                    "deals.view", "deals.create", "deals.update",
                    "calls.make", "calls.receive", "calls.view", "calls.recordings.play",
                    "followups.view", "followups.create", "followups.update",
                    "properties.view", "properties.update", "site_visits.view", "site_visits.create", "bookings.view", "bookings.create",
                    "investors.view", "investors.create", "consultations.view", "consultations.create", "opportunities.view", "opportunities.create",
                    "reports.view", "reports.export",
                    "users.view"
                },
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new Role
            {
                Id = salesExecutiveRoleId,
                Name = "Sales Executive",
                Code = "sales_executive",
                Permissions = new List<string>
                {
                    "leads.view", "leads.create", "leads.update", "leads.convert",
                    "customers.view", "customers.create", "customers.update",
                    "deals.view", "deals.create", "deals.update",
                    "calls.make", "calls.receive", "calls.view",
                    "followups.view", "followups.create", "followups.update",
                    "properties.view", "site_visits.view", "site_visits.create", "bookings.view", "bookings.create",
                    "investors.view", "investors.create", "consultations.view", "consultations.create", "opportunities.view", "opportunities.create",
                    "reports.view"
                },
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            // IRM Role — Inbound Routing & Relationship Manager
            new Role
            {
                Id = irmRoleId,
                Name = "IRM Agent",
                Code = "irm",
                Permissions = new List<string>
                {
                    "leads.view", "leads.create", "leads.update", "leads.assign",
                    "calls.make", "calls.receive", "calls.view", "calls.recordings.play",
                    "followups.view", "followups.create", "followups.update",
                    "reports.view"
                },
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            }
        );

        // 2. Tenants (Integer IDs 1, 2)
        modelBuilder.Entity<Tenant>().HasData(
            new Tenant
            {
                Id = 1,
                Name = "GHL India Ventures",
                Slug = "ghl",
                BrandColor = "#0284c7",
                Tagline = "Institutional Wealth & Real Estate Investment Advisory",
                EnabledFeatures = new List<string>
                {
                    "leads", "customers", "deals", "followups", "calls", "call-recording",
                    "call-transcription", "investors", "consultations", "investment-opportunities",
                    "reports", "users", "roles", "company-settings", "audit-logs"
                },
                Timezone = "Asia/Kolkata (IST)",
                Currency = "₹ INR",
                BusinessHours = "09:30 AM - 07:00 PM IST",
                IsActive = true,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new Tenant
            {
                Id = 2,
                Name = "Jamin Bazaar",
                Slug = "jamin",
                BrandColor = "#059669",
                Tagline = "Premium Plotted Enclaves & Farmland Communities",
                EnabledFeatures = new List<string>
                {
                    "leads", "customers", "deals", "followups", "calls", "call-recording",
                    "call-transcription", "properties", "site-visits", "bookings",
                    "reports", "users", "roles", "company-settings", "audit-logs"
                },
                Timezone = "Asia/Kolkata (IST)",
                Currency = "₹ INR",
                BusinessHours = "09:00 AM - 06:30 PM IST",
                IsActive = true,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            }
        );

        // 3. Demo Users (Integer IDs 1, 2, 3, 4 - Password: Password@123)
        var passwordHash = "$2a$11$z2c3Nc1pe7Tqmxj6Rm15NOt8vuAyyKfqzGtBKpiFU2NcPZxsjt5p.";

        modelBuilder.Entity<User>().HasData(
            // Super Admin
            new User
            {
                Id = 1,
                Name = "Alex Rivera (Super Admin)",
                Email = "alex@nexusplatform.io",
                PasswordHash = passwordHash,
                Phone = "+91 98800 11000",
                RoleId = superAdminRoleId,
                CompanyId = null,
                Status = UserStatus.Active,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            // GHL Company Admin (Vikram)
            new User
            {
                Id = 2,
                Name = "Vikram Malhotra",
                Email = "vikram@ghlindiatrust.com",
                PasswordHash = passwordHash,
                Phone = "+91 98450 11223",
                RoleId = companyAdminRoleId,
                CompanyId = 1,
                Status = UserStatus.Active,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            // GHL Sales Executive (Ananya)
            new User
            {
                Id = 3,
                Name = "Ananya Iyer",
                Email = "ananya@ghlindiatrust.com",
                PasswordHash = passwordHash,
                Phone = "+91 98450 22334",
                RoleId = salesExecutiveRoleId,
                CompanyId = 1,
                Status = UserStatus.Active,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            // Jamin Company Admin (Kavita)
            new User
            {
                Id = 4,
                Name = "Kavita Rao",
                Email = "kavita@jaminbazaar.com",
                PasswordHash = passwordHash,
                Phone = "+91 98450 33445",
                RoleId = companyAdminRoleId,
                CompanyId = 2,
                Status = UserStatus.Active,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            // GHL IRM Agent (Priya) — Inbound Routing & Relationship Manager
            new User
            {
                Id = 5,
                Name = "Priya Sharma",
                Email = "priya.irm@ghlindiatrust.com",
                PasswordHash = passwordHash,
                Phone = "+91 98450 44556",
                RoleId = irmRoleId,
                CompanyId = 1,
                Status = UserStatus.Active,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            }
        );

        // 4. Seed Demo Customers
        modelBuilder.Entity<Customer>().HasData(
            new Customer
            {
                Id = 1,
                CompanyId = 1,
                AssignedToUserId = 3, // Ananya (Sales Executive)
                Name = "Dr. Rajesh K. Varma",
                Email = "dr.rajesh.varma@healthcare.org",
                Phone = "+91 98800 23456",
                Location = "Indiranagar, Bengaluru",
                Status = "Active",
                KycStatus = "Verified",
                Notes = "Senior Cardiologist. Interested in commercial healthcare real estate.",
                CreatedAt = new DateTime(2026, 1, 15, 0, 0, 0, DateTimeKind.Utc)
            },
            new Customer
            {
                Id = 2,
                CompanyId = 1,
                AssignedToUserId = 3,
                Name = "Meera Nambiar",
                Email = "meera.nambiar@techglobal.in",
                Phone = "+91 98800 34567",
                Location = "Koramangala, Bengaluru",
                Status = "VIP",
                KycStatus = "Submitted",
                Notes = "Tech VP, looking for fractional Grade-A office spaces.",
                CreatedAt = new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc)
            }
        );

        // 5. Seed Demo KYC Record
        modelBuilder.Entity<CustomerKyc>().HasData(
            new CustomerKyc
            {
                Id = 1,
                CompanyId = 1,
                CustomerId = 1,
                DocumentType = "PAN",
                DocumentNumber = "ABCDE1234F",
                FullNameAsPerDocument = "Dr. Rajesh Kumar Varma",
                DateOfBirth = new DateTime(1978, 5, 20, 0, 0, 0, DateTimeKind.Utc),
                Gender = "Male",
                Nationality = "Indian",
                AddressLine1 = "Plot 42, 12th Main",
                AddressLine2 = "HAL 2nd Stage, Indiranagar",
                City = "Bengaluru",
                State = "Karnataka",
                PostalCode = "560038",
                Country = "India",
                Status = "Verified",
                SubmittedAt = new DateTime(2026, 1, 16, 10, 30, 0, DateTimeKind.Utc),
                VerifiedAt = new DateTime(2026, 1, 17, 14, 0, 0, DateTimeKind.Utc),
                VerifiedByUserId = 2, // Vikram (Admin)
                VerificationRemarks = "PAN card and medical council registration verified.",
                CreatedAt = new DateTime(2026, 1, 16, 10, 30, 0, DateTimeKind.Utc)
            },
            new CustomerKyc
            {
                Id = 2,
                CompanyId = 1,
                CustomerId = 2,
                DocumentType = "Aadhaar",
                DocumentNumber = "9876-5432-1098",
                FullNameAsPerDocument = "Meera Nambiar",
                DateOfBirth = new DateTime(1985, 11, 12, 0, 0, 0, DateTimeKind.Utc),
                Gender = "Female",
                Nationality = "Indian",
                AddressLine1 = "Villa 8, Greenwood Enclave",
                City = "Bengaluru",
                State = "Karnataka",
                PostalCode = "560034",
                Country = "India",
                Status = "Submitted",
                SubmittedAt = new DateTime(2026, 2, 2, 11, 0, 0, DateTimeKind.Utc),
                VerificationRemarks = "Aadhaar e-KYC documents submitted, pending manager sign-off.",
                CreatedAt = new DateTime(2026, 2, 2, 11, 0, 0, DateTimeKind.Utc)
            }
        );
    }
}
