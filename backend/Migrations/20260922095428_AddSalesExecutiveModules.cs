using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class AddSalesExecutiveModules : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CallRecords",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CompanyId = table.Column<int>(type: "integer", nullable: false),
                    AgentId = table.Column<int>(type: "integer", nullable: false),
                    LeadId = table.Column<int>(type: "integer", nullable: true),
                    CustomerId = table.Column<int>(type: "integer", nullable: true),
                    ContactName = table.Column<string>(type: "text", nullable: false),
                    ContactPhone = table.Column<string>(type: "text", nullable: false),
                    Direction = table.Column<string>(type: "text", nullable: false),
                    DurationSeconds = table.Column<int>(type: "integer", nullable: false),
                    Disposition = table.Column<string>(type: "text", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    StartedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CallRecords", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ExecutiveProfiles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CompanyId = table.Column<int>(type: "integer", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    EmployeeId = table.Column<string>(type: "text", nullable: true),
                    Designation = table.Column<string>(type: "text", nullable: true),
                    WorkingHours = table.Column<string>(type: "text", nullable: true),
                    MaxActiveLeads = table.Column<int>(type: "integer", nullable: false),
                    Skills = table.Column<List<string>>(type: "text[]", nullable: false),
                    Languages = table.Column<List<string>>(type: "text[]", nullable: false),
                    Specializations = table.Column<List<string>>(type: "text[]", nullable: false),
                    AutoAnswerCalls = table.Column<bool>(type: "boolean", nullable: false),
                    CallRecordingEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExecutiveProfiles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Followups",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CompanyId = table.Column<int>(type: "integer", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    LeadId = table.Column<int>(type: "integer", nullable: true),
                    ScheduledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Followups", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Leads",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CompanyId = table.Column<int>(type: "integer", nullable: false),
                    AssignedToUserId = table.Column<int>(type: "integer", nullable: true),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Email = table.Column<string>(type: "text", nullable: false),
                    Phone = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Leads", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Notifications",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CompanyId = table.Column<int>(type: "integer", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: false),
                    Message = table.Column<string>(type: "text", nullable: false),
                    Type = table.Column<string>(type: "text", nullable: false),
                    IsRead = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Notifications", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PasswordResetTokens",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    TokenHash = table.Column<string>(type: "text", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UsedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PasswordResetTokens", x => x.Id);
                });

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

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CallRecords");

            migrationBuilder.DropTable(
                name: "ExecutiveProfiles");

            migrationBuilder.DropTable(
                name: "Followups");

            migrationBuilder.DropTable(
                name: "Leads");

            migrationBuilder.DropTable(
                name: "Notifications");

            migrationBuilder.DropTable(
                name: "PasswordResetTokens");

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
