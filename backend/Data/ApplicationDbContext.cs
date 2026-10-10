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
    public DbSet<SiteVisit> SiteVisits => Set<SiteVisit>();
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

    // ── Jamin Bazaar specific tables ─────────────────────────────────────────
    /// <summary>Jamin land development projects (e.g. Greenfield Meadows Phase 2).</summary>
    public DbSet<JaminProject> JaminProjects => Set<JaminProject>();

    /// <summary>Individual plots within a Jamin project layout.</summary>
    public DbSet<JaminPlot> JaminPlots => Set<JaminPlot>();

    /// <summary>Plot booking/sale agreements with lifecycle tracking.</summary>
    public DbSet<JaminBooking> JaminBookings => Set<JaminBooking>();

    /// <summary>Payment ledger entries for plot bookings.</summary>
    public DbSet<JaminPayment> JaminPayments => Set<JaminPayment>();

    // IRM Entities
    public DbSet<Investor> Investors => Set<Investor>();
    public DbSet<InvestorKyc> InvestorKycs => Set<InvestorKyc>();
    public DbSet<InvestmentOpportunity> InvestmentOpportunities => Set<InvestmentOpportunity>();
    public DbSet<OpportunityPitch> OpportunityPitches => Set<OpportunityPitch>();
    public DbSet<InvestorCall> InvestorCalls => Set<InvestorCall>();
    public DbSet<IrmPipelineCard> IrmPipelineCards => Set<IrmPipelineCard>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<JaminBooking>(entity =>
        {
            entity.ToTable("jamin_bookings");
            entity.HasIndex(b => new { b.CompanyId, b.PlotId })
                .HasDatabaseName("IX_jamin_bookings_CompanyId_PlotId_Active")
                .HasFilter("\"PlotId\" IS NOT NULL AND \"Status\" IN ('Hold', 'Pending Verification', 'Booking Pending Verification', 'Token Paid', 'Token Verified', 'Agreement Signed', 'Registration Completed')")
                .IsUnique();
        });

        modelBuilder.Entity<JaminPayment>(entity =>
        {
            entity.ToTable("jamin_payments");
            entity.HasOne(p => p.Booking)
                .WithMany(b => b.Payments)
                .HasForeignKey(p => p.BookingId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(p => p.Customer)
                .WithMany(c => c.Payments)
                .HasForeignKey(p => p.CustomerId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(p => p.Company)
                .WithMany()
                .HasForeignKey(p => p.CompanyId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Apply entity configurations
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);

        // Seed initial roles, tenants, and demo users
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
                    "reports.view", "reports.export", "users.view"
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
            new Role
            {
                Id = irmRoleId,
                Name = "IRM",
                Code = "irm",
                Permissions = new List<string>
                {
                    "leads.view", "leads.create", "followups.view", "followups.create", "followups.update",
                    "deals.view", "deals.create", "deals.update",
                    "investors.view", "investors.create", "investors.update",
                    "consultations.view", "consultations.create", "consultations.update",
                    "opportunities.view", "opportunities.create", "opportunities.update",
                    "calls.make", "calls.receive", "calls.view",
                    "reports.view", "chat.view", "chat.send"
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

        // 3. Demo Users (Integer IDs 1 to 6 - Password: Password@123)
        var passwordHash = "$2a$11$z2c3Nc1pe7Tqmxj6Rm15NOt8vuAyyKfqzGtBKpiFU2NcPZxsjt5p.";

        modelBuilder.Entity<User>().HasData(
            // 1. Super Admin (Yanosh - Global Platform Console)
            new User
            {
                Id = 1,
                Name = "Yanosh",
                Email = "yanosh@ghlindiaventures.com",
                PasswordHash = passwordHash,
                Phone = "+91 98800 11000",
                RoleId = superAdminRoleId,
                CompanyId = null,
                Status = UserStatus.Active,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            // 2. GHL Company Admin (Vishnu)
            new User
            {
                Id = 2,
                Name = "Vishnu",
                Email = "vishnu@ghlindiaventures.com",
                PasswordHash = passwordHash,
                Phone = "+91 98450 11223",
                RoleId = companyAdminRoleId,
                CompanyId = 1,
                Status = UserStatus.Active,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            // 3. GHL Sales Executive (Naveen)
            new User
            {
                Id = 3,
                Name = "Naveen",
                Email = "naveen@ghlindiaventures.com",
                PasswordHash = passwordHash,
                Phone = "+91 98450 22334",
                RoleId = salesExecutiveRoleId,
                CompanyId = 1,
                Status = UserStatus.Active,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            // 4. Jamin Company Admin (Mani)
            new User
            {
                Id = 4,
                Name = "Mani",
                Email = "mani@ghlindiaventures.com",
                PasswordHash = passwordHash,
                Phone = "+91 98450 33445",
                RoleId = companyAdminRoleId,
                CompanyId = 2,
                Status = UserStatus.Active,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            // 5. GHL IRM (Dhinakaran)
            new User
            {
                Id = 5,
                Name = "Dhinakaran",
                Email = "dhinakaran@ghlindiaventures.com",
                PasswordHash = passwordHash,
                Phone = "+91 98110 77889",
                RoleId = irmRoleId,
                CompanyId = 1,
                Status = UserStatus.Active,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            // 6. Jamin Sales Executive (Rajesh Sharma)
            new User
            {
                Id = 6,
                Name = "Rajesh Sharma",
                Email = "rajesh@jaminbazaar.com",
                PasswordHash = passwordHash,
                Phone = "+91 98450 44556",
                RoleId = salesExecutiveRoleId,
                CompanyId = 2,
                Status = UserStatus.Active,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            }
        );

        // 4. Sample Investors (GHL Company 1)
        modelBuilder.Entity<Investor>().HasData(
            new Investor
            {
                Id = 1,
                CompanyId = 1,
                Name = "Rajesh Singhania",
                Phone = "+91 98200 44556",
                Email = "rajesh.singhania@apexcapital.in",
                Status = InvestorStatus.ActiveInvestor,
                InvestmentCapacity = "₹5 Cr – ₹10 Cr",
                PreferredAssetClass = "AIF",
                RiskTolerance = "Moderate",
                InvestmentMandate = "Growth focused Category II AIF with commercial allocation",
                CommittedAum = "₹5.0 Cr",
                ReferralSource = "Wealth Partner Direct",
                AssignedIrmId = 5,
                AssignedIrmName = "Dhinakaran",
                Notes = "Senior HNI investor with portfolio in Bangalore",
                CreatedAt = new DateTime(2026, 1, 15, 0, 0, 0, DateTimeKind.Utc)
            },
            new Investor
            {
                Id = 2,
                CompanyId = 1,
                Name = "Meera Nambiar",
                Phone = "+91 98450 99881",
                Email = "meera.nambiar@nambiarholdings.com",
                Status = InvestorStatus.Lead,
                InvestmentCapacity = "₹10 Cr – ₹25 Cr",
                PreferredAssetClass = "Commercial AIF",
                RiskTolerance = "Aggressive",
                InvestmentMandate = "High-yield commercial development tranches",
                AssignedIrmId = 5,
                AssignedIrmName = "Dhinakaran",
                Notes = "Family office lead referred via CFO network",
                CreatedAt = new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc)
            }
        );

        // 5. Sample Investment Opportunity
        modelBuilder.Entity<InvestmentOpportunity>().HasData(
            new InvestmentOpportunity
            {
                Id = 1,
                CompanyId = 1,
                CreatedByIrmId = 5,
                Title = "Prime Bengaluru Commercial Yield Fund II",
                AssetClass = "Commercial AIF",
                Description = "Grade-A office park pre-leased to Fortune 500 GCCs with 8.5% entry cap rate",
                TargetIrr = 16.5m,
                MinTicketSize = 10000000m,
                Tenure = "5 Years",
                RiskLevel = "Moderate",
                TotalTargetCorpus = 1000000000m,
                CommittedAmount = 50000000m,
                IsActive = true,
                CreatedAt = new DateTime(2026, 1, 10, 0, 0, 0, DateTimeKind.Utc)
            }
        );

        // 6. Sample IRM Pipeline Cards
        modelBuilder.Entity<IrmPipelineCard>().HasData(
            new IrmPipelineCard
            {
                Id = 1,
                CompanyId = 1,
                InvestorId = 1,
                AssignedIrmId = 5,
                AssignedIrmName = "Dhinakaran",
                InvestorName = "Rajesh Singhania",
                InvestorPhone = "+91 98200 44556",
                InvestorEmail = "rajesh.singhania@apexcapital.in",
                StageId = "qualified_investor",
                StageEnteredAt = new DateTime(2026, 2, 10, 0, 0, 0, DateTimeKind.Utc),
                Priority = "High",
                Value = 50000000m,
                InvestmentAmount = "₹5 Cr",
                PreferredAssetClass = "AIF",
                CreatedAt = new DateTime(2026, 1, 15, 0, 0, 0, DateTimeKind.Utc)
            },
            new IrmPipelineCard
            {
                Id = 2,
                CompanyId = 1,
                InvestorId = 2,
                AssignedIrmId = 5,
                AssignedIrmName = "Dhinakaran",
                InvestorName = "Meera Nambiar",
                InvestorPhone = "+91 98450 99881",
                InvestorEmail = "meera.nambiar@nambiarholdings.com",
                StageId = "leads",
                StageEnteredAt = new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc),
                Priority = "High",
                Value = 100000000m,
                InvestmentAmount = "₹10 Cr",
                PreferredAssetClass = "Commercial AIF",
                CreatedAt = new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc)
            }
        );
    }
}
