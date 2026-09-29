using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class AddSuperAdminPlatformModules : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "CallEnabled",
                table: "tenants",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "Industry",
                table: "tenants",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "LeadSla",
                table: "tenants",
                type: "integer",
                nullable: false,
                defaultValue: 15);

            migrationBuilder.AddColumn<string>(
                name: "LegalName",
                table: "tenants",
                type: "character varying(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "RecordingEnabled",
                table: "tenants",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "tenants",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "Active");

            migrationBuilder.AddColumn<string>(
                name: "SubscriptionPlan",
                table: "tenants",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "TranscriptionEnabled",
                table: "tenants",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.Sql(@"
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'followups' AND column_name = 'Priority') THEN
                        ALTER TABLE followups ADD COLUMN ""Priority"" character varying(50) NOT NULL DEFAULT 'Medium';
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'followups' AND column_name = 'ContactType') THEN
                        ALTER TABLE followups ADD COLUMN ""ContactType"" character varying(50) NOT NULL DEFAULT 'lead';
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'followups' AND column_name = 'Notes') THEN
                        ALTER TABLE followups ADD COLUMN ""Notes"" text NOT NULL DEFAULT '';
                    END IF;
                END $$;
            ");

            migrationBuilder.CreateTable(
                name: "broadcast_announcements",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Title = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    Message = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    Priority = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false, defaultValue: "info"),
                    TargetAudience = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false, defaultValue: "all"),
                    TargetTenantId = table.Column<int>(type: "integer", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false, defaultValue: "Super Admin")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_broadcast_announcements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_broadcast_announcements_tenants_TargetTenantId",
                        column: x => x.TargetTenantId,
                        principalTable: "tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "platform_carrier_settings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PrimaryCarrier = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    SecondaryCarrier = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    SipRealm = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    WebRtcGatewayUrl = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    RecordingRetentionDays = table.Column<int>(type: "integer", nullable: false, defaultValue: 180),
                    MaxConcurrentChannels = table.Column<int>(type: "integer", nullable: false, defaultValue: 100),
                    EmergencyRoutingEnabled = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    WhisperAiModel = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    LastTestedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    TestStatus = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_platform_carrier_settings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "platform_settings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    MaintenanceModeEnabled = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    MaintenanceMessage = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false, defaultValue: "Platform under scheduled maintenance."),
                    BypassSecret = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false, defaultValue: "nexus-admin-2026"),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_platform_settings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "subscription_packages",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Description = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    Tier = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false, defaultValue: "Starter"),
                    PriceMonthly = table.Column<decimal>(type: "numeric(12,2)", nullable: false, defaultValue: 0m),
                    Currency = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false, defaultValue: "₹"),
                    MaxUsers = table.Column<int>(type: "integer", nullable: false, defaultValue: 15),
                    MaxStorageGb = table.Column<int>(type: "integer", nullable: false, defaultValue: 50),
                    Features = table.Column<List<string>>(type: "text[]", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    IsPopular = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_subscription_packages", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "tenant_did_mappings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PhoneNumber = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    TenantId = table.Column<int>(type: "integer", nullable: true),
                    RoutingStrategy = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false, defaultValue: "Round-Robin"),
                    QueueName = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false, defaultValue: "Inbound Queue"),
                    EnableRecording = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    EnableAiWhisper = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false, defaultValue: "Online"),
                    ChannelsCount = table.Column<int>(type: "integer", nullable: false, defaultValue: 8),
                    AllocatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    Notes = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tenant_did_mappings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_tenant_did_mappings_tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.InsertData(
                table: "broadcast_announcements",
                columns: new[] { "Id", "CreatedAt", "CreatedBy", "ExpiresAt", "IsActive", "Message", "Priority", "TargetAudience", "TargetTenantId", "Title" },
                values: new object[] { 1, new DateTime(2026, 9, 26, 8, 0, 0, 0, DateTimeKind.Utc), "Yanosh", new DateTime(2026, 9, 27, 6, 0, 0, 0, DateTimeKind.Utc), true, "Scheduled zero-downtime database optimization today at 11:30 PM IST. Telephony routing will not be interrupted.", "info", "all", null, "Platform Infrastructure Upgrade" });

            migrationBuilder.InsertData(
                table: "platform_carrier_settings",
                columns: new[] { "Id", "EmergencyRoutingEnabled", "LastTestedAt", "MaxConcurrentChannels", "PrimaryCarrier", "RecordingRetentionDays", "SecondaryCarrier", "SipRealm", "TestStatus", "UpdatedAt", "WebRtcGatewayUrl", "WhisperAiModel" },
                values: new object[] { 1, true, new DateTime(2026, 9, 26, 10, 0, 0, 0, DateTimeKind.Utc), 100, "Twilio Elastic SIP Trunking (Mumbai AP-South)", 180, "Exotel Cloud Gateway (Failover Redundant)", "sip.trunk.nexusplatform.io:5060", "Success", new DateTime(2026, 9, 26, 10, 0, 0, 0, DateTimeKind.Utc), "wss://webrtc.nexusplatform.io/gateway", "OpenAI Whisper-Large-v3 (Self-Hosted on GPU cluster)" });

            migrationBuilder.InsertData(
                table: "platform_settings",
                columns: new[] { "Id", "BypassSecret", "MaintenanceMessage", "UpdatedAt" },
                values: new object[] { 1, "nexus-admin-2026", "Platform under scheduled maintenance.", new DateTime(2026, 9, 26, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.UpdateData(
                table: "roles",
                keyColumn: "Id",
                keyValue: 1,
                column: "Permissions",
                value: new List<string> { "leads.view", "leads.create", "leads.update", "leads.delete", "leads.assign", "leads.export", "leads.import", "leads.convert", "customers.view", "customers.create", "customers.update", "customers.delete", "deals.view", "deals.create", "deals.update", "deals.delete", "calls.make", "calls.receive", "calls.view", "calls.recordings.play", "followups.view", "followups.create", "followups.update", "properties.view", "properties.update", "site_visits.view", "site_visits.create", "bookings.view", "bookings.create", "investors.view", "investors.create", "consultations.view", "consultations.create", "opportunities.view", "opportunities.create", "reports.view", "reports.export", "users.view", "users.manage", "roles.view", "roles.manage", "settings.view", "settings.update", "audit.view", "platform.companies.manage", "platform.packages.manage", "platform.call_config.manage" });

            migrationBuilder.UpdateData(
                table: "roles",
                keyColumn: "Id",
                keyValue: 2,
                column: "Permissions",
                value: new List<string> { "leads.view", "leads.create", "leads.update", "leads.delete", "leads.assign", "leads.export", "leads.import", "leads.convert", "customers.view", "customers.create", "customers.update", "customers.delete", "deals.view", "deals.create", "deals.update", "deals.delete", "calls.make", "calls.receive", "calls.view", "calls.recordings.play", "followups.view", "followups.create", "followups.update", "properties.view", "properties.update", "site_visits.view", "site_visits.create", "bookings.view", "bookings.create", "investors.view", "investors.create", "consultations.view", "consultations.create", "opportunities.view", "opportunities.create", "reports.view", "reports.export", "users.view", "users.manage", "roles.view", "settings.view", "settings.update", "audit.view" });

            migrationBuilder.UpdateData(
                table: "roles",
                keyColumn: "Id",
                keyValue: 3,
                column: "Permissions",
                value: new List<string> { "leads.view", "leads.create", "leads.update", "leads.assign", "leads.export", "leads.convert", "customers.view", "customers.create", "customers.update", "deals.view", "deals.create", "deals.update", "calls.make", "calls.receive", "calls.view", "calls.recordings.play", "followups.view", "followups.create", "followups.update", "properties.view", "properties.update", "site_visits.view", "site_visits.create", "bookings.view", "bookings.create", "investors.view", "investors.create", "consultations.view", "consultations.create", "opportunities.view", "opportunities.create", "reports.view", "reports.export", "users.view" });

            migrationBuilder.UpdateData(
                table: "roles",
                keyColumn: "Id",
                keyValue: 4,
                column: "Permissions",
                value: new List<string> { "leads.view", "leads.create", "leads.update", "leads.convert", "customers.view", "customers.create", "customers.update", "deals.view", "deals.create", "deals.update", "calls.make", "calls.receive", "calls.view", "followups.view", "followups.create", "followups.update", "properties.view", "site_visits.view", "site_visits.create", "bookings.view", "bookings.create", "investors.view", "investors.create", "consultations.view", "consultations.create", "opportunities.view", "opportunities.create", "reports.view" });

            migrationBuilder.UpdateData(
                table: "roles",
                keyColumn: "Id",
                keyValue: 5,
                column: "Permissions",
                value: new List<string> { "leads.view", "leads.create", "followups.view", "followups.create", "followups.update", "deals.view", "deals.create", "deals.update", "investors.view", "investors.create", "investors.update", "consultations.view", "consultations.create", "consultations.update", "opportunities.view", "opportunities.create", "opportunities.update", "calls.make", "calls.receive", "calls.view", "reports.view", "chat.view", "chat.send" });

            migrationBuilder.InsertData(
                table: "subscription_packages",
                columns: new[] { "Id", "Code", "CreatedAt", "Currency", "Description", "Features", "IsActive", "MaxStorageGb", "MaxUsers", "Name", "PriceMonthly", "Tier", "UpdatedAt" },
                values: new object[] { 1, "starter_crm", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "₹", "Essential inbound leads, customer directory, softphone calling, and follow-ups.", new List<string> { "leads", "customers", "followups", "calls", "reports" }, true, 50, 15, "Starter CRM Tier", 14999m, "Starter", null });

            migrationBuilder.InsertData(
                table: "subscription_packages",
                columns: new[] { "Id", "Code", "CreatedAt", "Currency", "Description", "Features", "IsActive", "IsPopular", "MaxStorageGb", "MaxUsers", "Name", "PriceMonthly", "Tier", "UpdatedAt" },
                values: new object[] { 2, "jamin_real_estate_pro", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "₹", "Tailored for plotted development builders with interactive plot layouts, site visit logistics, and token bookings.", new List<string> { "leads", "customers", "deals", "followups", "calls", "call-recording", "call-transcription", "properties", "site-visits", "bookings", "reports" }, true, true, 250, 50, "Plotted Land Operations Pro", 39999m, "Growth", null });

            migrationBuilder.InsertData(
                table: "subscription_packages",
                columns: new[] { "Id", "Code", "CreatedAt", "Currency", "Description", "Features", "IsActive", "MaxStorageGb", "MaxUsers", "Name", "PriceMonthly", "Tier", "UpdatedAt" },
                values: new object[] { 3, "ghl_wealth_enterprise", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "₹", "Engineered for institutional capital syndicates, private family offices, and CRE investment opportunities.", new List<string> { "leads", "customers", "deals", "followups", "calls", "call-recording", "call-transcription", "investors", "consultations", "investment-opportunities", "reports" }, true, 1000, 150, "Wealth Advisory Enterprise Suite", 79999m, "Enterprise", null });

            migrationBuilder.InsertData(
                table: "tenant_did_mappings",
                columns: new[] { "Id", "AllocatedAt", "ChannelsCount", "EnableAiWhisper", "EnableRecording", "Notes", "PhoneNumber", "QueueName", "RoutingStrategy", "Status", "TenantId" },
                values: new object[,]
                {
                    { 1, new DateTime(2026, 1, 10, 10, 0, 0, 0, DateTimeKind.Utc), 8, true, true, "Primary inbound trunk for HNW wealth consultations", "+91 80 4700 8001", "HNW Wealth Advisory Queue", "Skill/Priority", "Online", 1 },
                    { 2, new DateTime(2026, 1, 15, 14, 30, 0, 0, DateTimeKind.Utc), 12, true, true, "Buyer inquiry hotline for gated community layouts", "+91 80 4700 8002", "Plotted Enclaves Telecallers", "Round-Robin", "Online", 2 }
                });

            migrationBuilder.InsertData(
                table: "tenant_did_mappings",
                columns: new[] { "Id", "AllocatedAt", "ChannelsCount", "Notes", "PhoneNumber", "QueueName", "RoutingStrategy", "Status", "TenantId" },
                values: new object[] { 3, new DateTime(2026, 2, 1, 9, 0, 0, 0, DateTimeKind.Utc), 4, "Spare DID number for next enterprise onboarding", "+91 80 4700 8003", "Available DID Reserve", "Round-Robin", "Reserved", null });

            migrationBuilder.UpdateData(
                table: "tenants",
                keyColumn: "Id",
                keyValue: 1,
                columns: new[] { "CallEnabled", "EnabledFeatures", "Industry", "LeadSla", "LegalName", "RecordingEnabled", "Status", "SubscriptionPlan", "TranscriptionEnabled" },
                values: new object[] { true, new List<string> { "leads", "customers", "deals", "followups", "calls", "call-recording", "call-transcription", "investors", "consultations", "investment-opportunities", "reports", "users", "roles", "company-settings", "audit-logs" }, "Commercial Real Estate & AIF", 15, "GHL India Advisory Trust Private Limited", true, "Active", "Wealth Advisory Enterprise Suite", true });

            migrationBuilder.UpdateData(
                table: "tenants",
                keyColumn: "Id",
                keyValue: 2,
                columns: new[] { "CallEnabled", "EnabledFeatures", "Industry", "LeadSla", "LegalName", "RecordingEnabled", "Status", "SubscriptionPlan", "TranscriptionEnabled" },
                values: new object[] { true, new List<string> { "leads", "customers", "deals", "followups", "calls", "call-recording", "call-transcription", "properties", "site-visits", "bookings", "reports", "users", "roles", "company-settings", "audit-logs" }, "Plotted Real Estate & Farmland", 30, "Jamin Bazaar Plotted Communities Private Limited", true, "Active", "Plotted Land Operations Pro", true });

            migrationBuilder.CreateIndex(
                name: "IX_broadcast_announcements_TargetTenantId",
                table: "broadcast_announcements",
                column: "TargetTenantId");

            migrationBuilder.CreateIndex(
                name: "IX_subscription_packages_Code",
                table: "subscription_packages",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_tenant_did_mappings_PhoneNumber",
                table: "tenant_did_mappings",
                column: "PhoneNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_tenant_did_mappings_TenantId",
                table: "tenant_did_mappings",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "broadcast_announcements");

            migrationBuilder.DropTable(
                name: "platform_carrier_settings");

            migrationBuilder.DropTable(
                name: "platform_settings");

            migrationBuilder.DropTable(
                name: "subscription_packages");

            migrationBuilder.DropTable(
                name: "tenant_did_mappings");

            migrationBuilder.DropColumn(
                name: "CallEnabled",
                table: "tenants");

            migrationBuilder.DropColumn(
                name: "Industry",
                table: "tenants");

            migrationBuilder.DropColumn(
                name: "LeadSla",
                table: "tenants");

            migrationBuilder.DropColumn(
                name: "LegalName",
                table: "tenants");

            migrationBuilder.DropColumn(
                name: "RecordingEnabled",
                table: "tenants");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "tenants");

            migrationBuilder.DropColumn(
                name: "SubscriptionPlan",
                table: "tenants");

            migrationBuilder.DropColumn(
                name: "TranscriptionEnabled",
                table: "tenants");

            migrationBuilder.AlterColumn<string>(
                name: "Status",
                table: "followups",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "Pending",
                oldClrType: typeof(string),
                oldType: "character varying(50)",
                oldMaxLength: 50);

            migrationBuilder.AlterColumn<string>(
                name: "Priority",
                table: "followups",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "Medium",
                oldClrType: typeof(string),
                oldType: "character varying(50)",
                oldMaxLength: 50);

            migrationBuilder.UpdateData(
                table: "roles",
                keyColumn: "Id",
                keyValue: 1,
                column: "Permissions",
                value: new List<string> { "leads.view", "leads.create", "leads.update", "leads.delete", "leads.assign", "leads.export", "leads.import", "leads.convert", "customers.view", "customers.create", "customers.update", "customers.delete", "deals.view", "deals.create", "deals.update", "deals.delete", "calls.make", "calls.receive", "calls.view", "calls.recordings.play", "followups.view", "followups.create", "followups.update", "properties.view", "properties.update", "site_visits.view", "site_visits.create", "bookings.view", "bookings.create", "investors.view", "investors.create", "consultations.view", "consultations.create", "opportunities.view", "opportunities.create", "reports.view", "reports.export", "users.view", "users.manage", "roles.view", "roles.manage", "settings.view", "settings.update", "audit.view", "platform.companies.manage", "platform.packages.manage", "platform.call_config.manage" });

            migrationBuilder.UpdateData(
                table: "roles",
                keyColumn: "Id",
                keyValue: 2,
                column: "Permissions",
                value: new List<string> { "leads.view", "leads.create", "leads.update", "leads.delete", "leads.assign", "leads.export", "leads.import", "leads.convert", "customers.view", "customers.create", "customers.update", "customers.delete", "deals.view", "deals.create", "deals.update", "deals.delete", "calls.make", "calls.receive", "calls.view", "calls.recordings.play", "followups.view", "followups.create", "followups.update", "properties.view", "properties.update", "site_visits.view", "site_visits.create", "bookings.view", "bookings.create", "investors.view", "investors.create", "consultations.view", "consultations.create", "opportunities.view", "opportunities.create", "reports.view", "reports.export", "users.view", "users.manage", "roles.view", "settings.view", "settings.update", "audit.view" });

            migrationBuilder.UpdateData(
                table: "roles",
                keyColumn: "Id",
                keyValue: 3,
                column: "Permissions",
                value: new List<string> { "leads.view", "leads.create", "leads.update", "leads.assign", "leads.export", "leads.convert", "customers.view", "customers.create", "customers.update", "deals.view", "deals.create", "deals.update", "calls.make", "calls.receive", "calls.view", "calls.recordings.play", "followups.view", "followups.create", "followups.update", "properties.view", "properties.update", "site_visits.view", "site_visits.create", "bookings.view", "bookings.create", "investors.view", "investors.create", "consultations.view", "consultations.create", "opportunities.view", "opportunities.create", "reports.view", "reports.export", "users.view" });

            migrationBuilder.UpdateData(
                table: "roles",
                keyColumn: "Id",
                keyValue: 4,
                column: "Permissions",
                value: new List<string> { "leads.view", "leads.create", "leads.update", "leads.convert", "customers.view", "customers.create", "customers.update", "deals.view", "deals.create", "deals.update", "calls.make", "calls.receive", "calls.view", "followups.view", "followups.create", "followups.update", "properties.view", "site_visits.view", "site_visits.create", "bookings.view", "bookings.create", "investors.view", "investors.create", "consultations.view", "consultations.create", "opportunities.view", "opportunities.create", "reports.view" });

            migrationBuilder.UpdateData(
                table: "roles",
                keyColumn: "Id",
                keyValue: 5,
                column: "Permissions",
                value: new List<string> { "leads.view", "leads.create", "followups.view", "followups.create", "followups.update", "deals.view", "deals.create", "deals.update", "investors.view", "investors.create", "investors.update", "consultations.view", "consultations.create", "consultations.update", "opportunities.view", "opportunities.create", "opportunities.update", "calls.make", "calls.receive", "calls.view", "reports.view", "chat.view", "chat.send" });

            migrationBuilder.UpdateData(
                table: "tenants",
                keyColumn: "Id",
                keyValue: 1,
                column: "EnabledFeatures",
                value: new List<string> { "leads", "customers", "deals", "followups", "calls", "call-recording", "call-transcription", "investors", "consultations", "investment-opportunities", "reports", "users", "roles", "company-settings", "audit-logs" });

            migrationBuilder.UpdateData(
                table: "tenants",
                keyColumn: "Id",
                keyValue: 2,
                column: "EnabledFeatures",
                value: new List<string> { "leads", "customers", "deals", "followups", "calls", "call-recording", "call-transcription", "properties", "site-visits", "bookings", "reports", "users", "roles", "company-settings", "audit-logs" });
        }
    }
}
