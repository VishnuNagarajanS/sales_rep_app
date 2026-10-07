using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class AddMfaEntitiesAndTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AuditLogs_tenants_TargetTenantId",
                table: "AuditLogs");

            migrationBuilder.DropForeignKey(
                name: "FK_GhlInvestmentOpportunities_GhlInvestors_InvestorId",
                table: "GhlInvestmentOpportunities");

            migrationBuilder.DropTable(
                name: "GhlInvestors");

            migrationBuilder.DropTable(
                name: "InvestorCalls");

            migrationBuilder.DropTable(
                name: "IrmPipelineCards");

            migrationBuilder.DropTable(
                name: "OpportunityPitches");

            migrationBuilder.DropIndex(
                name: "IX_AuditLogs_TargetTenantId",
                table: "AuditLogs");

            migrationBuilder.DeleteData(
                table: "AuditLogs",
                keyColumn: "Id",
                keyValue: 1);

            migrationBuilder.DeleteData(
                table: "InvestmentOpportunities",
                keyColumn: "Id",
                keyValue: 1);

            migrationBuilder.DeleteData(
                table: "Investors",
                keyColumn: "Id",
                keyValue: 1);

            migrationBuilder.DeleteData(
                table: "Investors",
                keyColumn: "Id",
                keyValue: 2);

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "AuditLogs");

            migrationBuilder.DropColumn(
                name: "CreatedBy",
                table: "AuditLogs");

            migrationBuilder.DropColumn(
                name: "ExpiresAt",
                table: "AuditLogs");

            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "AuditLogs");

            migrationBuilder.DropColumn(
                name: "Message",
                table: "AuditLogs");

            migrationBuilder.DropColumn(
                name: "Priority",
                table: "AuditLogs");

            migrationBuilder.DropColumn(
                name: "TargetAudience",
                table: "AuditLogs");

            migrationBuilder.DropColumn(
                name: "TargetTenantId",
                table: "AuditLogs");

            migrationBuilder.DropColumn(
                name: "Title",
                table: "AuditLogs");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "AuditLogs");

            migrationBuilder.AddColumn<bool>(
                name: "IsProtected",
                table: "users",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsTwoFactorEnabled",
                table: "users",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "MustChangePassword",
                table: "users",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "TwoFactorRecoveryCodesJson",
                table: "users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TwoFactorSecret",
                table: "users",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsProtected",
                table: "tenants",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "RecordingUrl",
                table: "call_records",
                type: "character varying(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Transcript",
                table: "call_records",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TwilioCallSid",
                table: "call_records",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

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
                name: "mfa_challenges",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    ChallengeTokenHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    AttemptCount = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    IpAddress = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    UserAgent = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_mfa_challenges", x => x.Id);
                    table.ForeignKey(
                        name: "FK_mfa_challenges_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "mfa_recovery_codes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    CodeHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    UsedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_mfa_recovery_codes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_mfa_recovery_codes_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "security_events",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: true),
                    EventType = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ActorEmail = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    IpAddress = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    UserAgent = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    Details = table.Column<string>(type: "text", nullable: false),
                    Severity = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false, defaultValue: "info"),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_security_events", x => x.Id);
                    table.ForeignKey(
                        name: "FK_security_events_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "user_mfa_settings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    IsEnabled = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    SecretEncrypted = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    PendingSecretEncrypted = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    EnabledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastUsedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    FailedAttempts = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    LockedUntil = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_mfa_settings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_user_mfa_settings_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "user_sessions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    TokenId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    IpAddress = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    UserAgent = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    Device = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Location = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    LastActivityAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RevokedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RevokedReason = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_sessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_user_sessions_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "broadcast_announcements",
                columns: new[] { "Id", "CreatedAt", "CreatedBy", "ExpiresAt", "IsActive", "Message", "Priority", "TargetAudience", "TargetTenantId", "Title", "UpdatedAt" },
                values: new object[] { 1, new DateTime(2026, 9, 26, 8, 0, 0, 0, DateTimeKind.Utc), "Yanosh", new DateTime(2026, 12, 31, 23, 59, 59, 0, DateTimeKind.Utc), true, "Scheduled zero-downtime database optimization today at 11:30 PM IST. Telephony routing will not be interrupted.", "info", "all", null, "Platform Infrastructure Upgrade", null });

            migrationBuilder.UpdateData(
                table: "roles",
                keyColumn: "Id",
                keyValue: 1,
                column: "Permissions",
                value: new List<string> { "leads.view", "leads.create", "leads.update", "leads.delete", "leads.assign", "leads.export", "leads.import", "leads.convert", "customers.view", "customers.create", "customers.update", "customers.delete", "deals.view", "deals.create", "deals.update", "deals.delete", "calls.make", "calls.receive", "calls.view", "calls.recordings.play", "followups.view", "followups.create", "followups.update", "properties.view", "properties.update", "site_visits.view", "site_visits.create", "bookings.view", "bookings.create", "investors.view", "investors.create", "consultations.view", "consultations.create", "opportunities.view", "opportunities.create", "reports.view", "reports.export", "users.view", "users.manage", "roles.view", "roles.manage", "settings.view", "settings.update", "audit.view", "platform.companies.manage", "platform.packages.manage", "platform.call_config.manage", "kyc.verify" });

            migrationBuilder.UpdateData(
                table: "roles",
                keyColumn: "Id",
                keyValue: 2,
                column: "Permissions",
                value: new List<string> { "leads.view", "leads.create", "leads.update", "leads.delete", "leads.assign", "leads.export", "leads.import", "leads.convert", "customers.view", "customers.create", "customers.update", "customers.delete", "deals.view", "deals.create", "deals.update", "deals.delete", "calls.make", "calls.receive", "calls.view", "calls.recordings.play", "followups.view", "followups.create", "followups.update", "properties.view", "properties.update", "site_visits.view", "site_visits.create", "bookings.view", "bookings.create", "investors.view", "investors.create", "consultations.view", "consultations.create", "opportunities.view", "opportunities.create", "reports.view", "reports.export", "users.view", "users.manage", "roles.view", "settings.view", "settings.update", "audit.view", "kyc.verify" });

            migrationBuilder.UpdateData(
                table: "roles",
                keyColumn: "Id",
                keyValue: 3,
                column: "Permissions",
                value: new List<string> { "leads.view", "leads.create", "leads.update", "leads.convert", "customers.view", "customers.create", "customers.update", "deals.view", "deals.create", "deals.update", "calls.make", "calls.receive", "calls.view", "followups.view", "followups.create", "followups.update", "properties.view", "site_visits.view", "site_visits.create", "bookings.view", "bookings.create", "investors.view", "investors.create", "consultations.view", "consultations.create", "opportunities.view", "opportunities.create", "reports.view" });

            migrationBuilder.UpdateData(
                table: "roles",
                keyColumn: "Id",
                keyValue: 4,
                column: "Permissions",
                value: new List<string> { "leads.view", "leads.create", "followups.view", "followups.create", "followups.update", "deals.view", "deals.create", "deals.update", "investors.view", "investors.create", "investors.update", "consultations.view", "consultations.create", "consultations.update", "opportunities.view", "opportunities.create", "opportunities.update", "calls.make", "calls.receive", "calls.view", "reports.view", "chat.view", "chat.send", "kyc.verify" });

            migrationBuilder.UpdateData(
                table: "subscription_packages",
                keyColumn: "Id",
                keyValue: 1,
                column: "Features",
                value: new List<string> { "leads", "customers", "followups", "calls", "reports" });

            migrationBuilder.UpdateData(
                table: "subscription_packages",
                keyColumn: "Id",
                keyValue: 2,
                column: "Features",
                value: new List<string> { "leads", "customers", "deals", "followups", "calls", "call-recording", "call-transcription", "properties", "site-visits", "bookings", "reports" });

            migrationBuilder.UpdateData(
                table: "subscription_packages",
                keyColumn: "Id",
                keyValue: 3,
                column: "Features",
                value: new List<string> { "leads", "customers", "deals", "followups", "calls", "call-recording", "call-transcription", "investors", "consultations", "investment-opportunities", "reports" });

            migrationBuilder.UpdateData(
                table: "tenants",
                keyColumn: "Id",
                keyValue: 1,
                columns: new[] { "EnabledFeatures", "IsProtected" },
                values: new object[] { new List<string> { "leads", "customers", "deals", "followups", "calls", "call-recording", "call-transcription", "investors", "consultations", "investment-opportunities", "reports", "users", "roles", "company-settings", "audit-logs" }, true });

            migrationBuilder.UpdateData(
                table: "tenants",
                keyColumn: "Id",
                keyValue: 2,
                columns: new[] { "EnabledFeatures", "IsProtected" },
                values: new object[] { new List<string> { "leads", "customers", "deals", "followups", "calls", "call-recording", "call-transcription", "properties", "site-visits", "bookings", "reports", "users", "roles", "company-settings", "audit-logs" }, true });

            migrationBuilder.UpdateData(
                table: "users",
                keyColumn: "Id",
                keyValue: 1,
                columns: new[] { "IsProtected", "TwoFactorRecoveryCodesJson", "TwoFactorSecret" },
                values: new object[] { true, null, null });

            migrationBuilder.UpdateData(
                table: "users",
                keyColumn: "Id",
                keyValue: 2,
                columns: new[] { "TwoFactorRecoveryCodesJson", "TwoFactorSecret" },
                values: new object[] { null, null });

            migrationBuilder.UpdateData(
                table: "users",
                keyColumn: "Id",
                keyValue: 3,
                columns: new[] { "TwoFactorRecoveryCodesJson", "TwoFactorSecret" },
                values: new object[] { null, null });

            migrationBuilder.UpdateData(
                table: "users",
                keyColumn: "Id",
                keyValue: 4,
                columns: new[] { "TwoFactorRecoveryCodesJson", "TwoFactorSecret" },
                values: new object[] { null, null });

            migrationBuilder.UpdateData(
                table: "users",
                keyColumn: "Id",
                keyValue: 5,
                columns: new[] { "TwoFactorRecoveryCodesJson", "TwoFactorSecret" },
                values: new object[] { null, null });

            migrationBuilder.UpdateData(
                table: "users",
                keyColumn: "Id",
                keyValue: 6,
                columns: new[] { "TwoFactorRecoveryCodesJson", "TwoFactorSecret" },
                values: new object[] { null, null });

            migrationBuilder.CreateIndex(
                name: "IX_leads_AssignedAgentId",
                table: "leads",
                column: "AssignedAgentId");

            migrationBuilder.CreateIndex(
                name: "IX_broadcast_announcements_TargetTenantId",
                table: "broadcast_announcements",
                column: "TargetTenantId");

            migrationBuilder.CreateIndex(
                name: "ux_broadcast_announcements_single_active_global",
                table: "broadcast_announcements",
                column: "IsActive",
                unique: true,
                filter: "\"IsActive\" = TRUE AND \"TargetTenantId\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_mfa_challenges_ChallengeTokenHash",
                table: "mfa_challenges",
                column: "ChallengeTokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_mfa_challenges_UserId_ExpiresAt",
                table: "mfa_challenges",
                columns: new[] { "UserId", "ExpiresAt" });

            migrationBuilder.CreateIndex(
                name: "IX_mfa_recovery_codes_UserId",
                table: "mfa_recovery_codes",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_mfa_recovery_codes_UserId_CodeHash",
                table: "mfa_recovery_codes",
                columns: new[] { "UserId", "CodeHash" });

            migrationBuilder.CreateIndex(
                name: "IX_security_events_CreatedAt_Severity",
                table: "security_events",
                columns: new[] { "CreatedAt", "Severity" });

            migrationBuilder.CreateIndex(
                name: "IX_security_events_EventType",
                table: "security_events",
                column: "EventType");

            migrationBuilder.CreateIndex(
                name: "IX_security_events_UserId",
                table: "security_events",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_user_mfa_settings_UserId",
                table: "user_mfa_settings",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_user_sessions_TokenId",
                table: "user_sessions",
                column: "TokenId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_user_sessions_UserId_IsActive",
                table: "user_sessions",
                columns: new[] { "UserId", "IsActive" });

            migrationBuilder.AddForeignKey(
                name: "FK_GhlInvestmentOpportunities_Investors_InvestorId",
                table: "GhlInvestmentOpportunities",
                column: "InvestorId",
                principalTable: "Investors",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_GhlInvestmentOpportunities_Investors_InvestorId",
                table: "GhlInvestmentOpportunities");

            migrationBuilder.DropTable(
                name: "broadcast_announcements");

            migrationBuilder.DropTable(
                name: "mfa_challenges");

            migrationBuilder.DropTable(
                name: "mfa_recovery_codes");

            migrationBuilder.DropTable(
                name: "security_events");

            migrationBuilder.DropTable(
                name: "user_mfa_settings");

            migrationBuilder.DropTable(
                name: "user_sessions");

            migrationBuilder.DropIndex(
                name: "IX_leads_AssignedAgentId",
                table: "leads");

            migrationBuilder.DropColumn(
                name: "IsProtected",
                table: "users");

            migrationBuilder.DropColumn(
                name: "IsTwoFactorEnabled",
                table: "users");

            migrationBuilder.DropColumn(
                name: "MustChangePassword",
                table: "users");

            migrationBuilder.DropColumn(
                name: "TwoFactorRecoveryCodesJson",
                table: "users");

            migrationBuilder.DropColumn(
                name: "TwoFactorSecret",
                table: "users");

            migrationBuilder.DropColumn(
                name: "IsProtected",
                table: "tenants");

            migrationBuilder.DropColumn(
                name: "RecordingUrl",
                table: "call_records");

            migrationBuilder.DropColumn(
                name: "Transcript",
                table: "call_records");

            migrationBuilder.DropColumn(
                name: "TwilioCallSid",
                table: "call_records");

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "AuditLogs",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "NOW()");

            migrationBuilder.AddColumn<string>(
                name: "CreatedBy",
                table: "AuditLogs",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "Super Admin");

            migrationBuilder.AddColumn<DateTime>(
                name: "ExpiresAt",
                table: "AuditLogs",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "AuditLogs",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "Message",
                table: "AuditLogs",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Priority",
                table: "AuditLogs",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "info");

            migrationBuilder.AddColumn<string>(
                name: "TargetAudience",
                table: "AuditLogs",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "all");

            migrationBuilder.AddColumn<int>(
                name: "TargetTenantId",
                table: "AuditLogs",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Title",
                table: "AuditLogs",
                type: "character varying(255)",
                maxLength: 255,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "AuditLogs",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "GhlInvestors",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    AssignedAgentId = table.Column<int>(type: "integer", nullable: false),
                    CompanyId = table.Column<int>(type: "integer", nullable: false),
                    CommittedAUM = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Email = table.Column<string>(type: "text", nullable: false),
                    InvestmentCapacity = table.Column<string>(type: "text", nullable: false),
                    InvestmentMandate = table.Column<string>(type: "text", nullable: true),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: false),
                    Phone = table.Column<string>(type: "text", nullable: false),
                    PreferredAssetClass = table.Column<string>(type: "text", nullable: false),
                    ReferralSource = table.Column<string>(type: "text", nullable: true),
                    RiskTolerance = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GhlInvestors", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GhlInvestors_tenants_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_GhlInvestors_users_AssignedAgentId",
                        column: x => x.AssignedAgentId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "InvestorCalls",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CompanyId = table.Column<int>(type: "integer", nullable: false),
                    InvestorId = table.Column<int>(type: "integer", nullable: false),
                    IrmId = table.Column<int>(type: "integer", nullable: false),
                    CalledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DurationSeconds = table.Column<int>(type: "integer", nullable: false),
                    InvestorName = table.Column<string>(type: "text", nullable: false),
                    InvestorPhone = table.Column<string>(type: "text", nullable: false),
                    IrmName = table.Column<string>(type: "text", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    Outcome = table.Column<int>(type: "integer", nullable: false),
                    RecordingUrl = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InvestorCalls", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InvestorCalls_Investors_InvestorId",
                        column: x => x.InvestorId,
                        principalTable: "Investors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_InvestorCalls_tenants_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_InvestorCalls_users_IrmId",
                        column: x => x.IrmId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "IrmPipelineCards",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    AssignedIrmId = table.Column<int>(type: "integer", nullable: false),
                    CompanyId = table.Column<int>(type: "integer", nullable: false),
                    InvestorId = table.Column<int>(type: "integer", nullable: false),
                    ActivityLogsJson = table.Column<string>(type: "text", nullable: true),
                    AssignedIrmName = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    InvestmentAmount = table.Column<string>(type: "text", nullable: true),
                    InvestorEmail = table.Column<string>(type: "text", nullable: false),
                    InvestorName = table.Column<string>(type: "text", nullable: false),
                    InvestorPhone = table.Column<string>(type: "text", nullable: false),
                    LastActionSnippet = table.Column<string>(type: "text", nullable: true),
                    LastActivityDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    PreferredAssetClass = table.Column<string>(type: "text", nullable: true),
                    Priority = table.Column<string>(type: "text", nullable: false),
                    StageEnteredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    StageId = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Value = table.Column<decimal>(type: "numeric", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IrmPipelineCards", x => x.Id);
                    table.ForeignKey(
                        name: "FK_IrmPipelineCards_Investors_InvestorId",
                        column: x => x.InvestorId,
                        principalTable: "Investors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_IrmPipelineCards_tenants_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_IrmPipelineCards_users_AssignedIrmId",
                        column: x => x.AssignedIrmId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OpportunityPitches",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    InvestorId = table.Column<int>(type: "integer", nullable: false),
                    OpportunityId = table.Column<int>(type: "integer", nullable: false),
                    PitchedByIrmId = table.Column<int>(type: "integer", nullable: false),
                    CommitmentNotes = table.Column<string>(type: "text", nullable: true),
                    CommittedAmount = table.Column<decimal>(type: "numeric", nullable: true),
                    CommittedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsCommitted = table.Column<bool>(type: "boolean", nullable: false),
                    PitchNotes = table.Column<string>(type: "text", nullable: true),
                    PitchedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OpportunityPitches", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OpportunityPitches_InvestmentOpportunities_OpportunityId",
                        column: x => x.OpportunityId,
                        principalTable: "InvestmentOpportunities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_OpportunityPitches_Investors_InvestorId",
                        column: x => x.InvestorId,
                        principalTable: "Investors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_OpportunityPitches_users_PitchedByIrmId",
                        column: x => x.PitchedByIrmId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "AuditLogs",
                columns: new[] { "Id", "CreatedAt", "CreatedBy", "ExpiresAt", "IsActive", "Message", "Priority", "TargetAudience", "TargetTenantId", "Title", "UpdatedAt" },
                values: new object[] { 1, new DateTime(2026, 9, 26, 8, 0, 0, 0, DateTimeKind.Utc), "Yanosh", new DateTime(2026, 12, 31, 23, 59, 59, 0, DateTimeKind.Utc), true, "Scheduled zero-downtime database optimization today at 11:30 PM IST. Telephony routing will not be interrupted.", "info", "all", null, "Platform Infrastructure Upgrade", null });

            migrationBuilder.InsertData(
                table: "InvestmentOpportunities",
                columns: new[] { "Id", "AssetClass", "BrochureUrl", "ClosingDate", "CommittedAmount", "CompanyId", "CreatedAt", "CreatedByIrmId", "Description", "FactsheetUrl", "IsActive", "MinTicketSize", "RiskLevel", "TargetIrr", "Tenure", "Title", "TotalTargetCorpus", "UpdatedAt" },
                values: new object[] { 1, "Commercial AIF", null, null, 50000000m, 1, new DateTime(2026, 1, 10, 0, 0, 0, 0, DateTimeKind.Utc), 5, "Grade-A office park pre-leased to Fortune 500 GCCs with 8.5% entry cap rate", null, true, 10000000m, "Moderate", 16.5m, "5 Years", "Prime Bengaluru Commercial Yield Fund II", 1000000000m, null });

            migrationBuilder.InsertData(
                table: "Investors",
                columns: new[] { "Id", "AssignedIrmId", "AssignedIrmName", "CommittedAum", "CompanyId", "CreatedAt", "Email", "InvestmentCapacity", "InvestmentMandate", "Name", "Notes", "Phone", "PreferredAssetClass", "ReferralSource", "RiskTolerance", "Status", "UpdatedAt" },
                values: new object[,]
                {
                    { 1, 5, "Dhinakaran", "₹5.0 Cr", 1, new DateTime(2026, 1, 15, 0, 0, 0, 0, DateTimeKind.Utc), "rajesh.singhania@apexcapital.in", "₹5 Cr – ₹10 Cr", "Growth focused Category II AIF with commercial allocation", "Rajesh Singhania", "Senior HNI investor with portfolio in Bangalore", "+91 98200 44556", "AIF", "Wealth Partner Direct", "Moderate", 1, null },
                    { 2, 5, "Dhinakaran", null, 1, new DateTime(2026, 2, 1, 0, 0, 0, 0, DateTimeKind.Utc), "meera.nambiar@nambiarholdings.com", "₹10 Cr – ₹25 Cr", "High-yield commercial development tranches", "Meera Nambiar", "Family office lead referred via CFO network", "+91 98450 99881", "Commercial AIF", null, "Aggressive", 0, null }
                });

            migrationBuilder.UpdateData(
                table: "roles",
                keyColumn: "Id",
                keyValue: 1,
                column: "Permissions",
                value: new List<string> { "leads.view", "leads.create", "leads.update", "leads.delete", "leads.assign", "leads.export", "leads.import", "leads.convert", "customers.view", "customers.create", "customers.update", "customers.delete", "deals.view", "deals.create", "deals.update", "deals.delete", "calls.make", "calls.receive", "calls.view", "calls.recordings.play", "followups.view", "followups.create", "followups.update", "properties.view", "properties.update", "site_visits.view", "site_visits.create", "bookings.view", "bookings.create", "investors.view", "investors.create", "consultations.view", "consultations.create", "opportunities.view", "opportunities.create", "reports.view", "reports.export", "users.view", "users.manage", "roles.view", "roles.manage", "settings.view", "settings.update", "audit.view", "platform.companies.manage", "platform.packages.manage", "platform.call_config.manage", "kyc.verify" });

            migrationBuilder.UpdateData(
                table: "roles",
                keyColumn: "Id",
                keyValue: 2,
                column: "Permissions",
                value: new List<string> { "leads.view", "leads.create", "leads.update", "leads.delete", "leads.assign", "leads.export", "leads.import", "leads.convert", "customers.view", "customers.create", "customers.update", "customers.delete", "deals.view", "deals.create", "deals.update", "deals.delete", "calls.make", "calls.receive", "calls.view", "calls.recordings.play", "followups.view", "followups.create", "followups.update", "properties.view", "properties.update", "site_visits.view", "site_visits.create", "bookings.view", "bookings.create", "investors.view", "investors.create", "consultations.view", "consultations.create", "opportunities.view", "opportunities.create", "reports.view", "reports.export", "users.view", "users.manage", "roles.view", "settings.view", "settings.update", "audit.view", "kyc.verify" });

            migrationBuilder.UpdateData(
                table: "roles",
                keyColumn: "Id",
                keyValue: 3,
                column: "Permissions",
                value: new List<string> { "leads.view", "leads.create", "leads.update", "leads.convert", "customers.view", "customers.create", "customers.update", "deals.view", "deals.create", "deals.update", "calls.make", "calls.receive", "calls.view", "followups.view", "followups.create", "followups.update", "properties.view", "site_visits.view", "site_visits.create", "bookings.view", "bookings.create", "investors.view", "investors.create", "consultations.view", "consultations.create", "opportunities.view", "opportunities.create", "reports.view" });

            migrationBuilder.UpdateData(
                table: "roles",
                keyColumn: "Id",
                keyValue: 4,
                column: "Permissions",
                value: new List<string> { "leads.view", "leads.create", "followups.view", "followups.create", "followups.update", "deals.view", "deals.create", "deals.update", "investors.view", "investors.create", "investors.update", "consultations.view", "consultations.create", "consultations.update", "opportunities.view", "opportunities.create", "opportunities.update", "calls.make", "calls.receive", "calls.view", "reports.view", "chat.view", "chat.send", "kyc.verify" });

            migrationBuilder.UpdateData(
                table: "subscription_packages",
                keyColumn: "Id",
                keyValue: 1,
                column: "Features",
                value: new List<string> { "leads", "customers", "followups", "calls", "reports" });

            migrationBuilder.UpdateData(
                table: "subscription_packages",
                keyColumn: "Id",
                keyValue: 2,
                column: "Features",
                value: new List<string> { "leads", "customers", "deals", "followups", "calls", "call-recording", "call-transcription", "properties", "site-visits", "bookings", "reports" });

            migrationBuilder.UpdateData(
                table: "subscription_packages",
                keyColumn: "Id",
                keyValue: 3,
                column: "Features",
                value: new List<string> { "leads", "customers", "deals", "followups", "calls", "call-recording", "call-transcription", "investors", "consultations", "investment-opportunities", "reports" });

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

            migrationBuilder.InsertData(
                table: "IrmPipelineCards",
                columns: new[] { "Id", "ActivityLogsJson", "AssignedIrmId", "AssignedIrmName", "CompanyId", "CreatedAt", "InvestmentAmount", "InvestorEmail", "InvestorId", "InvestorName", "InvestorPhone", "LastActionSnippet", "LastActivityDate", "PreferredAssetClass", "Priority", "StageEnteredAt", "StageId", "UpdatedAt", "Value" },
                values: new object[,]
                {
                    { 1, null, 5, "Dhinakaran", 1, new DateTime(2026, 1, 15, 0, 0, 0, 0, DateTimeKind.Utc), "₹5 Cr", "rajesh.singhania@apexcapital.in", 1, "Rajesh Singhania", "+91 98200 44556", null, null, "AIF", "High", new DateTime(2026, 2, 10, 0, 0, 0, 0, DateTimeKind.Utc), "qualified_investor", null, 50000000m },
                    { 2, null, 5, "Dhinakaran", 1, new DateTime(2026, 2, 1, 0, 0, 0, 0, DateTimeKind.Utc), "₹10 Cr", "meera.nambiar@nambiarholdings.com", 2, "Meera Nambiar", "+91 98450 99881", null, null, "Commercial AIF", "High", new DateTime(2026, 2, 1, 0, 0, 0, 0, DateTimeKind.Utc), "leads", null, 100000000m }
                });

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_TargetTenantId",
                table: "AuditLogs",
                column: "TargetTenantId");

            migrationBuilder.CreateIndex(
                name: "IX_GhlInvestors_AssignedAgentId",
                table: "GhlInvestors",
                column: "AssignedAgentId");

            migrationBuilder.CreateIndex(
                name: "IX_GhlInvestors_CompanyId",
                table: "GhlInvestors",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_InvestorCalls_CompanyId",
                table: "InvestorCalls",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_InvestorCalls_InvestorId",
                table: "InvestorCalls",
                column: "InvestorId");

            migrationBuilder.CreateIndex(
                name: "IX_InvestorCalls_IrmId",
                table: "InvestorCalls",
                column: "IrmId");

            migrationBuilder.CreateIndex(
                name: "IX_IrmPipelineCards_AssignedIrmId",
                table: "IrmPipelineCards",
                column: "AssignedIrmId");

            migrationBuilder.CreateIndex(
                name: "IX_IrmPipelineCards_CompanyId",
                table: "IrmPipelineCards",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_IrmPipelineCards_InvestorId",
                table: "IrmPipelineCards",
                column: "InvestorId");

            migrationBuilder.CreateIndex(
                name: "IX_OpportunityPitches_InvestorId",
                table: "OpportunityPitches",
                column: "InvestorId");

            migrationBuilder.CreateIndex(
                name: "IX_OpportunityPitches_OpportunityId",
                table: "OpportunityPitches",
                column: "OpportunityId");

            migrationBuilder.CreateIndex(
                name: "IX_OpportunityPitches_PitchedByIrmId",
                table: "OpportunityPitches",
                column: "PitchedByIrmId");

            migrationBuilder.AddForeignKey(
                name: "FK_AuditLogs_tenants_TargetTenantId",
                table: "AuditLogs",
                column: "TargetTenantId",
                principalTable: "tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_GhlInvestmentOpportunities_GhlInvestors_InvestorId",
                table: "GhlInvestmentOpportunities",
                column: "InvestorId",
                principalTable: "GhlInvestors",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
