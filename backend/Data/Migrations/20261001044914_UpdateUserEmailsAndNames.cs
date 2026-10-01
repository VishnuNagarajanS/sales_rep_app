using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class UpdateUserEmailsAndNames : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Sync user seed data: update existing users and insert any missing ones
            // using ON CONFLICT so it's safe to run multiple times
            migrationBuilder.Sql(@"
                INSERT INTO users (""Id"", ""Name"", ""Email"", ""PasswordHash"", ""Phone"", ""RoleId"", ""CompanyId"", ""Status"", ""CreatedAt"")
                VALUES
                    (1, 'Yanosh',       'yanosh@ghlindiaventures.com',    '$2a$11$z2c3Nc1pe7Tqmxj6Rm15NOt8vuAyyKfqzGtBKpiFU2NcPZxsjt5p.', '+91 98800 11000', 1, NULL, 'Active', '2026-01-01 00:00:00+00'),
                    (2, 'Vishnu',       'vishnu@ghlindiaventures.com',    '$2a$11$z2c3Nc1pe7Tqmxj6Rm15NOt8vuAyyKfqzGtBKpiFU2NcPZxsjt5p.', '+91 98450 11223', 2, 1,    'Active', '2026-01-01 00:00:00+00'),
                    (3, 'Naveen',       'naveen@ghlindiaventures.com',    '$2a$11$z2c3Nc1pe7Tqmxj6Rm15NOt8vuAyyKfqzGtBKpiFU2NcPZxsjt5p.', '+91 98450 22334', 4, 1,    'Active', '2026-01-01 00:00:00+00'),
                    (4, 'Mani',         'mani@ghlindiaventures.com',      '$2a$11$z2c3Nc1pe7Tqmxj6Rm15NOt8vuAyyKfqzGtBKpiFU2NcPZxsjt5p.', '+91 98450 33445', 2, 2,    'Active', '2026-01-01 00:00:00+00'),
                    (5, 'Dhinakaran',   'dhinakaran@ghlindiaventures.com','$2a$11$z2c3Nc1pe7Tqmxj6Rm15NOt8vuAyyKfqzGtBKpiFU2NcPZxsjt5p.', '+91 98110 77889', 5, 1,    'Active', '2026-01-01 00:00:00+00'),
                    (6, 'Rajesh Sharma','rajesh@jaminbazaar.com',          '$2a$11$z2c3Nc1pe7Tqmxj6Rm15NOt8vuAyyKfqzGtBKpiFU2NcPZxsjt5p.', '+91 98450 44556', 4, 2,    'Active', '2026-01-01 00:00:00+00')
                ON CONFLICT (""Id"") DO UPDATE SET
                    ""Name""         = EXCLUDED.""Name"",
                    ""Email""        = EXCLUDED.""Email"",
                    ""PasswordHash"" = EXCLUDED.""PasswordHash"",
                    ""Phone""        = EXCLUDED.""Phone"",
                    ""RoleId""       = EXCLUDED.""RoleId"",
                    ""CompanyId""    = EXCLUDED.""CompanyId"",
                    ""Status""       = EXCLUDED.""Status"";
            ");

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

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
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
