using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class AddSuperAdminEntitiesAndSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ── 1. Tenants Columns ───────────────────────────────────────────────────
            migrationBuilder.Sql(@"
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'CallEnabled') THEN
                        ALTER TABLE tenants ADD COLUMN ""CallEnabled"" boolean NOT NULL DEFAULT TRUE;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'Industry') THEN
                        ALTER TABLE tenants ADD COLUMN ""Industry"" character varying(128);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'LeadSla') THEN
                        ALTER TABLE tenants ADD COLUMN ""LeadSla"" integer;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'LegalName') THEN
                        ALTER TABLE tenants ADD COLUMN ""LegalName"" character varying(255);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'RecordingEnabled') THEN
                        ALTER TABLE tenants ADD COLUMN ""RecordingEnabled"" boolean NOT NULL DEFAULT TRUE;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'Status') THEN
                        ALTER TABLE tenants ADD COLUMN ""Status"" character varying(32) NOT NULL DEFAULT 'Active';
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'SubscriptionPlan') THEN
                        ALTER TABLE tenants ADD COLUMN ""SubscriptionPlan"" character varying(128);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'TranscriptionEnabled') THEN
                        ALTER TABLE tenants ADD COLUMN ""TranscriptionEnabled"" boolean NOT NULL DEFAULT TRUE;
                    END IF;
                END $$;
            ");

            // ── 2. Create 5 New Tables ────────────────────────────────────────────────
            migrationBuilder.CreateTable(
                name: "broadcast_announcements",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Title = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    Message = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    Priority = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false, defaultValue: "info"),
                    TargetAudience = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false, defaultValue: "all"),
                    TargetTenantId = table.Column<int>(type: "integer", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    CreatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false, defaultValue: "Super Admin"),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_broadcast_announcements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_broadcast_announcements_tenants_TargetTenantId",
                        column: x => x.TargetTenantId,
                        principalTable: "tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "carrier_settings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PrimaryCarrier = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    SecondaryCarrier = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    SipRealm = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    WebrtcGatewayUrl = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    RecordingRetentionDays = table.Column<int>(type: "integer", nullable: false),
                    MaxConcurrentChannels = table.Column<int>(type: "integer", nullable: false),
                    EmergencyRoutingEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    WhisperAiModel = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    AccountSid = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    AuthTokenEncrypted = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    PrimaryGatewayHost = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    FailoverGatewayHost = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    Status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false, defaultValue: "Active"),
                    LastTestedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    TestStatus = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_carrier_settings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "platform_settings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Key = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Value = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    UpdatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true)
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
                    Name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Tier = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false, defaultValue: "Growth"),
                    PriceMonthly = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Currency = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false, defaultValue: "₹"),
                    MaxUsers = table.Column<int>(type: "integer", nullable: false),
                    MaxStorageGb = table.Column<int>(type: "integer", nullable: false),
                    Features = table.Column<List<string>>(type: "text[]", nullable: false),
                    IsPopular = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
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
                    TenantId = table.Column<int>(type: "integer", nullable: true),
                    PhoneNumber = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    RoutingStrategy = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false, defaultValue: "Round-Robin"),
                    QueueName = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false, defaultValue: "Inbound Sales Queue"),
                    EnableRecording = table.Column<bool>(type: "boolean", nullable: false),
                    EnableAiWhisper = table.Column<bool>(type: "boolean", nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false, defaultValue: "Online"),
                    ChannelsCount = table.Column<int>(type: "integer", nullable: false, defaultValue: 8),
                    Notes = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    AllocatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
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

            // ── 3. Indexes ────────────────────────────────────────────────────────────
            migrationBuilder.CreateIndex(
                name: "IX_broadcast_announcements_TargetTenantId",
                table: "broadcast_announcements",
                column: "TargetTenantId");

            migrationBuilder.CreateIndex(
                name: "IX_platform_settings_Key",
                table: "platform_settings",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_subscription_packages_Code",
                table: "subscription_packages",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_tenant_did_mappings_PhoneNumber",
                table: "tenant_did_mappings",
                column: "PhoneNumber");

            migrationBuilder.CreateIndex(
                name: "IX_tenant_did_mappings_TenantId",
                table: "tenant_did_mappings",
                column: "TenantId");

            // ── 4. Seed Data Insertion ────────────────────────────────────────────────
            migrationBuilder.InsertData(
                table: "broadcast_announcements",
                columns: new[] { "Id", "CreatedAt", "CreatedBy", "ExpiresAt", "IsActive", "Message", "Priority", "TargetAudience", "TargetTenantId", "Title", "UpdatedAt" },
                values: new object[] { 1, new DateTime(2026, 9, 26, 8, 0, 0, 0, DateTimeKind.Utc), "Yanosh", new DateTime(2026, 12, 31, 23, 59, 59, 0, DateTimeKind.Utc), true, "Scheduled zero-downtime database optimization today at 11:30 PM IST. Telephony routing will not be interrupted.", "info", "all", null, "Platform Infrastructure Upgrade", null });

            migrationBuilder.InsertData(
                table: "carrier_settings",
                columns: new[] { "Id", "AccountSid", "AuthTokenEncrypted", "EmergencyRoutingEnabled", "FailoverGatewayHost", "LastTestedAt", "MaxConcurrentChannels", "PrimaryCarrier", "PrimaryGatewayHost", "RecordingRetentionDays", "SecondaryCarrier", "SipRealm", "Status", "TestStatus", "UpdatedAt", "WebrtcGatewayUrl", "WhisperAiModel" },
                values: new object[] { 1, null, null, true, "gateway.exotel.com", new DateTime(2026, 9, 26, 10, 0, 0, 0, DateTimeKind.Utc), 100, "Twilio Elastic SIP Trunking (Mumbai AP-South)", "sip.trunk.nexusplatform.io", 180, "Exotel Cloud Gateway (Failover Redundant)", "sip.trunk.nexusplatform.io:5060", "Active", "Success", new DateTime(2026, 9, 26, 10, 0, 0, 0, DateTimeKind.Utc), "wss://webrtc.nexusplatform.io/gateway", "OpenAI Whisper-Large-v3 (Self-Hosted on GPU cluster)" });

            migrationBuilder.InsertData(
                table: "platform_settings",
                columns: new[] { "Id", "Description", "Key", "UpdatedAt", "UpdatedBy", "Value" },
                values: new object[] { 1, "Global platform maintenance mode switch", "maintenance_mode", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "Super Admin", "{\"enabled\":false,\"message\":\"Platform under scheduled maintenance.\",\"bypassSecret\":\"nexus-admin-2026\"}" });

            migrationBuilder.InsertData(
                table: "subscription_packages",
                columns: new[] { "Id", "Code", "CreatedAt", "Currency", "Description", "Features", "IsActive", "IsPopular", "MaxStorageGb", "MaxUsers", "Name", "PriceMonthly", "Tier", "UpdatedAt" },
                values: new object[,]
                {
                    { 1, "starter_crm", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "₹", "Essential inbound leads, customer directory, softphone calling, and follow-ups.", new List<string> { "leads", "customers", "followups", "calls", "reports" }, true, false, 50, 15, "Starter CRM Tier", 14999m, "Starter", null },
                    { 2, "jamin_real_estate_pro", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "₹", "Tailored for plotted development builders with interactive plot layouts, site visit logistics, and token bookings.", new List<string> { "leads", "customers", "deals", "followups", "calls", "call-recording", "call-transcription", "properties", "site-visits", "bookings", "reports" }, true, true, 250, 50, "Plotted Land Operations Pro", 39999m, "Growth", null },
                    { 3, "ghl_wealth_enterprise", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "₹", "Engineered for institutional capital syndicates, private family offices, and CRE investment opportunities.", new List<string> { "leads", "customers", "deals", "followups", "calls", "call-recording", "call-transcription", "investors", "consultations", "investment-opportunities", "reports" }, true, false, 1000, 150, "Wealth Advisory Enterprise Suite", 79999m, "Enterprise", null }
                });

            migrationBuilder.InsertData(
                table: "tenant_did_mappings",
                columns: new[] { "Id", "AllocatedAt", "ChannelsCount", "CreatedAt", "EnableAiWhisper", "EnableRecording", "Notes", "PhoneNumber", "QueueName", "RoutingStrategy", "Status", "TenantId", "UpdatedAt" },
                values: new object[,]
                {
                    { 1, new DateTime(2026, 1, 10, 10, 0, 0, 0, DateTimeKind.Utc), 8, new DateTime(2026, 1, 10, 10, 0, 0, 0, DateTimeKind.Utc), true, true, "Primary inbound trunk for HNW wealth consultations", "+91 80 4700 8001", "HNW Wealth Advisory Queue", "Skill/Priority", "Online", 1, null },
                    { 2, new DateTime(2026, 1, 15, 14, 30, 0, 0, DateTimeKind.Utc), 12, new DateTime(2026, 1, 15, 14, 30, 0, 0, DateTimeKind.Utc), true, true, "Buyer inquiry hotline for gated community layouts", "+91 80 4700 8002", "Plotted Enclaves Telecallers", "Round-Robin", "Online", 2, null },
                    { 3, new DateTime(2026, 2, 1, 9, 0, 0, 0, DateTimeKind.Utc), 4, new DateTime(2026, 2, 1, 9, 0, 0, 0, DateTimeKind.Utc), false, false, "Spare DID number for next enterprise onboarding", "+91 80 4700 8003", "Available DID Reserve", "Round-Robin", "Reserved", null, null }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "broadcast_announcements");
            migrationBuilder.DropTable(name: "carrier_settings");
            migrationBuilder.DropTable(name: "platform_settings");
            migrationBuilder.DropTable(name: "subscription_packages");
            migrationBuilder.DropTable(name: "tenant_did_mappings");

            migrationBuilder.DropColumn(name: "CallEnabled", table: "tenants");
            migrationBuilder.DropColumn(name: "Industry", table: "tenants");
            migrationBuilder.DropColumn(name: "LeadSla", table: "tenants");
            migrationBuilder.DropColumn(name: "LegalName", table: "tenants");
            migrationBuilder.DropColumn(name: "RecordingEnabled", table: "tenants");
            migrationBuilder.DropColumn(name: "Status", table: "tenants");
            migrationBuilder.DropColumn(name: "SubscriptionPlan", table: "tenants");
            migrationBuilder.DropColumn(name: "TranscriptionEnabled", table: "tenants");
        }
    }
}
