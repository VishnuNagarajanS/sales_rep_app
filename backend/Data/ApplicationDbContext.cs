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
    public DbSet<Document> Documents => Set<Document>();
    public DbSet<Lead> Leads => Set<Lead>();
    public DbSet<LeadAssignmentHistory> LeadAssignmentHistories => Set<LeadAssignmentHistory>();
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

    /// <summary>Investment opportunity pipeline linked to GHL investors.</summary>
    public DbSet<GhlInvestmentOpportunity> GhlInvestmentOpportunities => Set<GhlInvestmentOpportunity>();

    // ── Platform-wide audit trail ────────────────────────────────────────────
    /// <summary>Immutable audit log of every create/update/delete action across all tenants.</summary>
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    // ── Super Admin Platform Management Entities ─────────────────────────────
    public DbSet<SubscriptionPackage> SubscriptionPackages => Set<SubscriptionPackage>();
    public DbSet<CarrierSettings> CarrierSettings => Set<CarrierSettings>();
    public DbSet<TenantDidMapping> TenantDidMappings => Set<TenantDidMapping>();
    public DbSet<BroadcastAnnouncement> BroadcastAnnouncements => Set<BroadcastAnnouncement>();
    public DbSet<PlatformSetting> PlatformSettings => Set<PlatformSetting>();

    // IRM Entities
    public DbSet<Investor> Investors => Set<Investor>();
    public DbSet<InvestorKyc> InvestorKycs => Set<InvestorKyc>();
    public DbSet<InvestmentOpportunity> InvestmentOpportunities => Set<InvestmentOpportunity>();
    public DbSet<KycOtpVerification> KycOtpVerifications => Set<KycOtpVerification>();
    public DbSet<IrmCoverageAssignment> IrmCoverageAssignments => Set<IrmCoverageAssignment>();

    public override int SaveChanges()
    {
        NormalizeContacts();
        return base.SaveChanges();
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        NormalizeContacts();
        return base.SaveChangesAsync(cancellationToken);
    }

    private void NormalizeContacts()
    {
        foreach (var entry in ChangeTracker.Entries<Lead>())
        {
            if (entry.State == EntityState.Added || entry.State == EntityState.Modified)
            {
                entry.Entity.NormalizedPhone = ContactNormalizer.NormalizePhone(entry.Entity.Phone);
                entry.Entity.NormalizedEmail = ContactNormalizer.NormalizeEmail(entry.Entity.Email);
            }
        }

        foreach (var entry in ChangeTracker.Entries<Customer>())
        {
            if (entry.State == EntityState.Added || entry.State == EntityState.Modified)
            {
                entry.Entity.NormalizedPhone = ContactNormalizer.NormalizePhone(entry.Entity.Phone);
                entry.Entity.NormalizedEmail = ContactNormalizer.NormalizeEmail(entry.Entity.Email);
            }
        }
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Apply entity configurations
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);

        // Seed initial roles, tenants, and demo users
        SeedData(modelBuilder);

        // Ignore dropped legacy tables so EF Core never queries or maps them
        modelBuilder.Ignore<GhlInvestor>();
        modelBuilder.Ignore<InvestorCall>();
        modelBuilder.Ignore<OpportunityPitch>();
        modelBuilder.Ignore<IrmPipelineCard>();
    }

    private static void SeedData(ModelBuilder modelBuilder)
    {
        // 1. Roles (Integer IDs 1, 2, 3, 4)
        var superAdminRoleId = 1;
        var companyAdminRoleId = 2;
        var salesExecutiveRoleId = 3;
        var irmRoleId = 4;

        modelBuilder.Entity<Role>().HasData(
            new Role
            {
                Id = superAdminRoleId,
                Name = "Super Admin",
                Code = "super_admin",
                Description = "Platform operator with unrestricted access across all tenants.",
                IsSystemRole = true,
                IsActive = true,
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
                    "platform.companies.manage", "platform.packages.manage", "platform.call_config.manage",
                    "kyc.verify"
                },
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new Role
            {
                Id = companyAdminRoleId,
                Name = "Company Admin",
                Code = "company_admin",
                Description = "Tenant root administrator managing team users and company setup.",
                IsSystemRole = true,
                IsActive = true,
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
                    "users.view", "users.manage", "roles.view", "settings.view", "settings.update", "audit.view",
                    "kyc.verify"
                },
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new Role
            {
                Id = salesExecutiveRoleId,
                Name = "Sales Executive",
                Code = "sales_executive",
                Description = "Frontline sales representative executing dialer outreach.",
                IsSystemRole = true,
                IsActive = true,
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
                Description = "Institutional Relationship Manager for HNW wealth & CRE.",
                IsSystemRole = true,
                IsActive = true,
                Permissions = new List<string>
                {
                    "leads.view", "leads.create", "followups.view", "followups.create", "followups.update",
                    "deals.view", "deals.create", "deals.update",
                    "investors.view", "investors.create", "investors.update",
                    "consultations.view", "consultations.create", "consultations.update",
                    "opportunities.view", "opportunities.create", "opportunities.update",
                    "calls.make", "calls.receive", "calls.view",
                    "reports.view", "chat.view", "chat.send",
                    "kyc.verify"
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

        // ── Super Admin Initial Seed Data ─────────────────────────────────────
        modelBuilder.Entity<SubscriptionPackage>().HasData(
            new SubscriptionPackage
            {
                Id = 1,
                Name = "Starter CRM Tier",
                Code = "starter_crm",
                Description = "Essential inbound leads, customer directory, softphone calling, and follow-ups.",
                Tier = "Starter",
                PriceMonthly = 14999m,
                Currency = "₹",
                MaxUsers = 15,
                MaxStorageGb = 50,
                Features = new List<string> { "leads", "customers", "followups", "calls", "reports" },
                IsPopular = false,
                IsActive = true,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new SubscriptionPackage
            {
                Id = 2,
                Name = "Plotted Land Operations Pro",
                Code = "jamin_real_estate_pro",
                Description = "Tailored for plotted development builders with interactive plot layouts, site visit logistics, and token bookings.",
                Tier = "Growth",
                PriceMonthly = 39999m,
                Currency = "₹",
                MaxUsers = 50,
                MaxStorageGb = 250,
                Features = new List<string> { "leads", "customers", "deals", "followups", "calls", "call-recording", "call-transcription", "properties", "site-visits", "bookings", "reports" },
                IsPopular = true,
                IsActive = true,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new SubscriptionPackage
            {
                Id = 3,
                Name = "Wealth Advisory Enterprise Suite",
                Code = "ghl_wealth_enterprise",
                Description = "Engineered for institutional capital syndicates, private family offices, and CRE investment opportunities.",
                Tier = "Enterprise",
                PriceMonthly = 79999m,
                Currency = "₹",
                MaxUsers = 150,
                MaxStorageGb = 1000,
                Features = new List<string> { "leads", "customers", "deals", "followups", "calls", "call-recording", "call-transcription", "investors", "consultations", "investment-opportunities", "reports" },
                IsPopular = false,
                IsActive = true,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            }
        );

        modelBuilder.Entity<CarrierSettings>().HasData(
            new CarrierSettings
            {
                Id = 1,
                PrimaryCarrier = "Twilio Elastic SIP Trunking (Mumbai AP-South)",
                SecondaryCarrier = "Exotel Cloud Gateway (Failover Redundant)",
                SipRealm = "sip.trunk.nexusplatform.io:5060",
                WebrtcGatewayUrl = "wss://webrtc.nexusplatform.io/gateway",
                RecordingRetentionDays = 180,
                MaxConcurrentChannels = 100,
                EmergencyRoutingEnabled = true,
                WhisperAiModel = "OpenAI Whisper-Large-v3 (Self-Hosted on GPU cluster)",
                PrimaryGatewayHost = "sip.trunk.nexusplatform.io",
                FailoverGatewayHost = "gateway.exotel.com",
                Status = "Active",
                TestStatus = "Success",
                LastTestedAt = new DateTime(2026, 9, 26, 10, 0, 0, DateTimeKind.Utc),
                UpdatedAt = new DateTime(2026, 9, 26, 10, 0, 0, DateTimeKind.Utc)
            }
        );

        modelBuilder.Entity<TenantDidMapping>().HasData(
            new TenantDidMapping
            {
                Id = 1,
                PhoneNumber = "+91 80 4700 8001",
                TenantId = 1,
                RoutingStrategy = "Skill/Priority",
                QueueName = "HNW Wealth Advisory Queue",
                EnableRecording = true,
                EnableAiWhisper = true,
                Status = "Online",
                ChannelsCount = 8,
                Notes = "Primary inbound trunk for HNW wealth consultations",
                AllocatedAt = new DateTime(2026, 1, 10, 10, 0, 0, DateTimeKind.Utc),
                CreatedAt = new DateTime(2026, 1, 10, 10, 0, 0, DateTimeKind.Utc)
            },
            new TenantDidMapping
            {
                Id = 2,
                PhoneNumber = "+91 80 4700 8002",
                TenantId = 2,
                RoutingStrategy = "Round-Robin",
                QueueName = "Plotted Enclaves Telecallers",
                EnableRecording = true,
                EnableAiWhisper = true,
                Status = "Online",
                ChannelsCount = 12,
                Notes = "Buyer inquiry hotline for gated community layouts",
                AllocatedAt = new DateTime(2026, 1, 15, 14, 30, 0, DateTimeKind.Utc),
                CreatedAt = new DateTime(2026, 1, 15, 14, 30, 0, DateTimeKind.Utc)
            },
            new TenantDidMapping
            {
                Id = 3,
                PhoneNumber = "+91 80 4700 8003",
                TenantId = null,
                RoutingStrategy = "Round-Robin",
                QueueName = "Available DID Reserve",
                EnableRecording = false,
                EnableAiWhisper = false,
                Status = "Reserved",
                ChannelsCount = 4,
                Notes = "Spare DID number for next enterprise onboarding",
                AllocatedAt = new DateTime(2026, 2, 1, 9, 0, 0, DateTimeKind.Utc),
                CreatedAt = new DateTime(2026, 2, 1, 9, 0, 0, DateTimeKind.Utc)
            }
        );

        modelBuilder.Entity<BroadcastAnnouncement>().HasData(
            new BroadcastAnnouncement
            {
                Id = 1,
                Title = "Platform Infrastructure Upgrade",
                Message = "Scheduled zero-downtime database optimization today at 11:30 PM IST. Telephony routing will not be interrupted.",
                Priority = "info",
                TargetAudience = "all",
                TargetTenantId = null,
                IsActive = true,
                CreatedBy = "Yanosh",
                CreatedAt = new DateTime(2026, 9, 26, 8, 0, 0, DateTimeKind.Utc),
                ExpiresAt = new DateTime(2026, 12, 31, 23, 59, 59, DateTimeKind.Utc)
            }
        );

        modelBuilder.Entity<PlatformSetting>().HasData(
            new PlatformSetting
            {
                Id = 1,
                Key = "maintenance_mode",
                Value = "{\"enabled\":false,\"message\":\"Platform under scheduled maintenance.\",\"bypassSecret\":\"nexus-admin-2026\"}",
                Description = "Global platform maintenance mode switch",
                UpdatedBy = "Super Admin",
                UpdatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            }
        );
    }
}
