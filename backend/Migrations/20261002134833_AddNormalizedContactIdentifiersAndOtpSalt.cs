using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class AddNormalizedContactIdentifiersAndOtpSalt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP INDEX IF EXISTS \"IX_leads_CompanyId\";");
            migrationBuilder.Sql("DROP INDEX IF EXISTS \"IX_customers_CompanyId_Phone\";");

            migrationBuilder.AddColumn<bool>(
                name: "IsDuplicate",
                table: "leads",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "NormalizedEmail",
                table: "leads",
                type: "character varying(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NormalizedPhone",
                table: "leads",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Salt",
                table: "KycOtpVerifications",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "IsDuplicate",
                table: "customers",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "NormalizedEmail",
                table: "customers",
                type: "character varying(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NormalizedPhone",
                table: "customers",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

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

            // 1. Populate NormalizedPhone and NormalizedEmail from existing Phone and Email
            migrationBuilder.Sql(@"
                UPDATE leads 
                SET ""NormalizedPhone"" = RIGHT(REGEXP_REPLACE(""Phone"", '\D', '', 'g'), 10),
                    ""NormalizedEmail"" = LOWER(TRIM(""Email""))
                WHERE ""NormalizedPhone"" IS NULL OR ""NormalizedEmail"" IS NULL;
            ");

            migrationBuilder.Sql(@"
                UPDATE customers 
                SET ""NormalizedPhone"" = RIGHT(REGEXP_REPLACE(""Phone"", '\D', '', 'g'), 10),
                    ""NormalizedEmail"" = LOWER(TRIM(""Email""))
                WHERE ""NormalizedPhone"" IS NULL OR ""NormalizedEmail"" IS NULL;
            ");

            // 2. Safe duplicate handling: mark existing duplicates with IsDuplicate = true so unique indexes succeed without deleting or merging records
            migrationBuilder.Sql(@"
                WITH ranked_phone_leads AS (
                    SELECT ""Id"", ROW_NUMBER() OVER (PARTITION BY ""CompanyId"", ""NormalizedPhone"" ORDER BY ""Id"" ASC) as rn
                    FROM leads
                    WHERE ""NormalizedPhone"" IS NOT NULL AND ""NormalizedPhone"" <> ''
                )
                UPDATE leads SET ""IsDuplicate"" = true WHERE ""Id"" IN (SELECT ""Id"" FROM ranked_phone_leads WHERE rn > 1);
            ");

            migrationBuilder.Sql(@"
                WITH ranked_email_leads AS (
                    SELECT ""Id"", ROW_NUMBER() OVER (PARTITION BY ""CompanyId"", ""NormalizedEmail"" ORDER BY ""Id"" ASC) as rn
                    FROM leads
                    WHERE ""NormalizedEmail"" IS NOT NULL AND ""NormalizedEmail"" <> ''
                )
                UPDATE leads SET ""IsDuplicate"" = true WHERE ""Id"" IN (SELECT ""Id"" FROM ranked_email_leads WHERE rn > 1);
            ");

            migrationBuilder.Sql(@"
                WITH ranked_phone_custs AS (
                    SELECT ""Id"", ROW_NUMBER() OVER (PARTITION BY ""CompanyId"", ""NormalizedPhone"" ORDER BY ""Id"" ASC) as rn
                    FROM customers
                    WHERE ""NormalizedPhone"" IS NOT NULL AND ""NormalizedPhone"" <> ''
                )
                UPDATE customers SET ""IsDuplicate"" = true WHERE ""Id"" IN (SELECT ""Id"" FROM ranked_phone_custs WHERE rn > 1);
            ");

            migrationBuilder.Sql(@"
                WITH ranked_email_custs AS (
                    SELECT ""Id"", ROW_NUMBER() OVER (PARTITION BY ""CompanyId"", ""NormalizedEmail"" ORDER BY ""Id"" ASC) as rn
                    FROM customers
                    WHERE ""NormalizedEmail"" IS NOT NULL AND ""NormalizedEmail"" <> ''
                )
                UPDATE customers SET ""IsDuplicate"" = true WHERE ""Id"" IN (SELECT ""Id"" FROM ranked_email_custs WHERE rn > 1);
            ");

            migrationBuilder.CreateIndex(
                name: "IX_leads_CompanyId_NormalizedEmail",
                table: "leads",
                columns: new[] { "CompanyId", "NormalizedEmail" },
                unique: true,
                filter: "\"IsDuplicate\" = false AND \"NormalizedEmail\" IS NOT NULL AND \"NormalizedEmail\" <> ''");

            migrationBuilder.CreateIndex(
                name: "IX_leads_CompanyId_NormalizedPhone",
                table: "leads",
                columns: new[] { "CompanyId", "NormalizedPhone" },
                unique: true,
                filter: "\"IsDuplicate\" = false AND \"NormalizedPhone\" IS NOT NULL AND \"NormalizedPhone\" <> ''");

            migrationBuilder.CreateIndex(
                name: "IX_customers_CompanyId_NormalizedEmail",
                table: "customers",
                columns: new[] { "CompanyId", "NormalizedEmail" },
                unique: true,
                filter: "\"IsDuplicate\" = false AND \"NormalizedEmail\" IS NOT NULL AND \"NormalizedEmail\" <> ''");

            migrationBuilder.CreateIndex(
                name: "IX_customers_CompanyId_NormalizedPhone",
                table: "customers",
                columns: new[] { "CompanyId", "NormalizedPhone" },
                unique: true,
                filter: "\"IsDuplicate\" = false AND \"NormalizedPhone\" IS NOT NULL AND \"NormalizedPhone\" <> ''");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_leads_CompanyId_NormalizedEmail",
                table: "leads");

            migrationBuilder.DropIndex(
                name: "IX_leads_CompanyId_NormalizedPhone",
                table: "leads");

            migrationBuilder.DropIndex(
                name: "IX_customers_CompanyId_NormalizedEmail",
                table: "customers");

            migrationBuilder.DropIndex(
                name: "IX_customers_CompanyId_NormalizedPhone",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "IsDuplicate",
                table: "leads");

            migrationBuilder.DropColumn(
                name: "NormalizedEmail",
                table: "leads");

            migrationBuilder.DropColumn(
                name: "NormalizedPhone",
                table: "leads");

            migrationBuilder.DropColumn(
                name: "Salt",
                table: "KycOtpVerifications");

            migrationBuilder.DropColumn(
                name: "IsDuplicate",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "NormalizedEmail",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "NormalizedPhone",
                table: "customers");

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
                name: "IX_leads_CompanyId",
                table: "leads",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_customers_CompanyId_Phone",
                table: "customers",
                columns: new[] { "CompanyId", "Phone" },
                unique: true);
        }
    }
}
