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

    // IRM Entities
    public DbSet<Investor> Investors => Set<Investor>();
    public DbSet<InvestorKyc> InvestorKycs => Set<InvestorKyc>();
    public DbSet<Consultation> Consultations => Set<Consultation>();
    public DbSet<InvestmentOpportunity> InvestmentOpportunities => Set<InvestmentOpportunity>();
    public DbSet<OpportunityPitch> OpportunityPitches => Set<OpportunityPitch>();
    public DbSet<Followup> Followups => Set<Followup>();
    public DbSet<InvestorCall> InvestorCalls => Set<InvestorCall>();
    public DbSet<IrmPipelineCard> IrmPipelineCards => Set<IrmPipelineCard>();

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
            new Role
            {
                Id = irmRoleId,
                Name = "IRM",
                Code = "irm",
                Permissions = new List<string>
                {
                    "leads.view", "followups.view", "followups.create", "followups.update",
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

        // 3. Demo Users (Password: Password@123)
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
            // GHL IRM (Rohan Varma)
            new User
            {
                Id = 5,
                Name = "Rohan Varma",
                Email = "rohan.varma@ghlindiatrust.com",
                PasswordHash = passwordHash,
                Phone = "+91 98110 77889",
                RoleId = irmRoleId,
                CompanyId = 1,
                Status = UserStatus.Active,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            // GHL IRM (Priya Sharma)
            new User
            {
                Id = 6,
                Name = "Priya Sharma",
                Email = "priya.irm@ghlindiatrust.com",
                PasswordHash = passwordHash,
                Phone = "+91 98450 66778",
                RoleId = irmRoleId,
                CompanyId = 1,
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
                AssignedIrmId = 2,
                AssignedIrmName = "Vikram Malhotra",
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
                AssignedIrmId = 2,
                AssignedIrmName = "Vikram Malhotra",
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
                CreatedByIrmId = 2,
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
                AssignedIrmId = 2,
                AssignedIrmName = "Vikram Malhotra",
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
                AssignedIrmId = 2,
                AssignedIrmName = "Vikram Malhotra",
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
