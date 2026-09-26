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
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Followup> Followups => Set<Followup>();
    public DbSet<Consultation> Consultations => Set<Consultation>();
    public DbSet<CallRecord> CallRecords => Set<CallRecord>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
    public DbSet<ExecutiveProfile> ExecutiveProfiles => Set<ExecutiveProfile>();

    // ── GHL India Ventures specific tables ──────────────────────────────────
    /// <summary>GHL pipeline deals (Sales Exec + IRM Kanban board).</summary>
    public DbSet<GhlDeal> GhlDeals => Set<GhlDeal>();

    /// <summary>Activity log entries for each GHL deal (notes, calls, stage changes).</summary>
    public DbSet<GhlDealActivity> GhlDealActivities => Set<GhlDealActivity>();

    /// <summary>HNW investor profiles managed by GHL India Ventures.</summary>
    public DbSet<GhlInvestor> GhlInvestors => Set<GhlInvestor>();

    /// <summary>Investment opportunity pipeline linked to GHL investors.</summary>
    public DbSet<GhlInvestmentOpportunity> GhlInvestmentOpportunities => Set<GhlInvestmentOpportunity>();

    // ── Platform-wide audit trail ────────────────────────────────────────────
    /// <summary>Immutable audit log of every create/update/delete action across all tenants.</summary>
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Apply entity configurations
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);

        // Seed initial roles, tenants, and demo users
        SeedData(modelBuilder);
    }

    private static void SeedData(ModelBuilder modelBuilder)
    {
        // 1. Roles (Integer IDs 1, 2, 3, 4)
        var superAdminRoleId = 1;
        var companyAdminRoleId = 2;
        var salesManagerRoleId = 3;
        var salesExecutiveRoleId = 4;

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
                BusinessHours = "10:00 AM - 06:30 PM IST",
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
                BusinessHours = "10:00 AM - 06:30 PM IST",
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
            }
        );
    }
}
