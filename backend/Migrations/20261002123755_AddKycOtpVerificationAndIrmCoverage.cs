using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class AddKycOtpVerificationAndIrmCoverage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP INDEX IF EXISTS \"IX_customers_CompanyId\";");

            migrationBuilder.AddColumn<int>(
                name: "AssistedByUserId",
                table: "InvestorKycs",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CustomerConsentDetails",
                table: "InvestorKycs",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "CustomerConsentObtained",
                table: "InvestorKycs",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "CustomerConsentTimestamp",
                table: "InvestorKycs",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsAssisted",
                table: "InvestorKycs",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsRevoked",
                table: "InvestorKycs",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "KycTokenHash",
                table: "InvestorKycs",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RevokedAt",
                table: "InvestorKycs",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ContactEmail",
                table: "followups",
                type: "character varying(255)",
                maxLength: 255,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "IrmCoverageAssignments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CompanyId = table.Column<int>(type: "integer", nullable: false),
                    OriginalIrmId = table.Column<int>(type: "integer", nullable: false),
                    CoveringIrmId = table.Column<int>(type: "integer", nullable: false),
                    ReassignedByUserId = table.Column<int>(type: "integer", nullable: false),
                    ReassignedByUserName = table.Column<string>(type: "text", nullable: false),
                    ReassignedByUserEmail = table.Column<string>(type: "text", nullable: false),
                    Reason = table.Column<string>(type: "text", nullable: false),
                    StartedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    ReassignedRecordIdsJson = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IrmCoverageAssignments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_IrmCoverageAssignments_tenants_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_IrmCoverageAssignments_users_CoveringIrmId",
                        column: x => x.CoveringIrmId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_IrmCoverageAssignments_users_OriginalIrmId",
                        column: x => x.OriginalIrmId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "KycOtpVerifications",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CompanyId = table.Column<int>(type: "integer", nullable: false),
                    InvestorKycId = table.Column<int>(type: "integer", nullable: true),
                    Token = table.Column<string>(type: "text", nullable: false),
                    TokenHash = table.Column<string>(type: "text", nullable: false),
                    Email = table.Column<string>(type: "text", nullable: false),
                    OtpHash = table.Column<string>(type: "text", nullable: false),
                    FailedAttempts = table.Column<int>(type: "integer", nullable: false),
                    ResendCount = table.Column<int>(type: "integer", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsVerified = table.Column<bool>(type: "boolean", nullable: false),
                    VerifiedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsInvalidated = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KycOtpVerifications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_KycOtpVerifications_InvestorKycs_InvestorKycId",
                        column: x => x.InvestorKycId,
                        principalTable: "InvestorKycs",
                        principalColumn: "Id");
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
                value: new List<string> { "leads.view", "leads.create", "followups.view", "followups.create", "followups.update", "deals.view", "deals.create", "deals.update", "investors.view", "investors.create", "investors.update", "consultations.view", "consultations.create", "consultations.update", "opportunities.view", "opportunities.create", "opportunities.update", "calls.make", "calls.receive", "calls.view", "reports.view", "chat.view", "chat.send", "kyc.verify" });

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

            migrationBuilder.CreateIndex(
                name: "IX_customers_CompanyId_Phone",
                table: "customers",
                columns: new[] { "CompanyId", "Phone" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_IrmCoverageAssignments_CompanyId",
                table: "IrmCoverageAssignments",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_IrmCoverageAssignments_CoveringIrmId",
                table: "IrmCoverageAssignments",
                column: "CoveringIrmId");

            migrationBuilder.CreateIndex(
                name: "IX_IrmCoverageAssignments_OriginalIrmId",
                table: "IrmCoverageAssignments",
                column: "OriginalIrmId");

            migrationBuilder.CreateIndex(
                name: "IX_KycOtpVerifications_InvestorKycId",
                table: "KycOtpVerifications",
                column: "InvestorKycId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "IrmCoverageAssignments");

            migrationBuilder.DropTable(
                name: "KycOtpVerifications");

            migrationBuilder.DropIndex(
                name: "IX_customers_CompanyId_Phone",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "AssistedByUserId",
                table: "InvestorKycs");

            migrationBuilder.DropColumn(
                name: "CustomerConsentDetails",
                table: "InvestorKycs");

            migrationBuilder.DropColumn(
                name: "CustomerConsentObtained",
                table: "InvestorKycs");

            migrationBuilder.DropColumn(
                name: "CustomerConsentTimestamp",
                table: "InvestorKycs");

            migrationBuilder.DropColumn(
                name: "IsAssisted",
                table: "InvestorKycs");

            migrationBuilder.DropColumn(
                name: "IsRevoked",
                table: "InvestorKycs");

            migrationBuilder.DropColumn(
                name: "KycTokenHash",
                table: "InvestorKycs");

            migrationBuilder.DropColumn(
                name: "RevokedAt",
                table: "InvestorKycs");

            migrationBuilder.DropColumn(
                name: "ContactEmail",
                table: "followups");

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
                value: new List<string> { "leads.view", "leads.create", "followups.view", "followups.create", "followups.update", "deals.view", "deals.create", "deals.update", "investors.view", "investors.create", "investors.update", "consultations.view", "consultations.create", "consultations.update", "opportunities.view", "opportunities.create", "opportunities.update", "calls.make", "calls.receive", "calls.view", "reports.view", "chat.view", "chat.send", "kyc.verify" });

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

            migrationBuilder.CreateIndex(
                name: "IX_customers_CompanyId",
                table: "customers",
                column: "CompanyId");
        }
    }
}
