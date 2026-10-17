using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class AddHandoverColumnsToIrmCards : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'IrmPipelineCards') THEN
                        ALTER TABLE ""IrmPipelineCards"" ADD COLUMN IF NOT EXISTS ""HandoverId"" integer;
                        ALTER TABLE ""IrmPipelineCards"" ADD COLUMN IF NOT EXISTS ""OriginalOwnerId"" integer;
                        CREATE INDEX IF NOT EXISTS ""IX_IrmPipelineCards_HandoverId"" ON ""IrmPipelineCards"" (""HandoverId"");
                        CREATE INDEX IF NOT EXISTS ""IX_IrmPipelineCards_OriginalOwnerId"" ON ""IrmPipelineCards"" (""OriginalOwnerId"");
                        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_IrmPipelineCards_work_handovers_HandoverId') THEN
                            ALTER TABLE ""IrmPipelineCards"" ADD CONSTRAINT ""FK_IrmPipelineCards_work_handovers_HandoverId"" FOREIGN KEY (""HandoverId"") REFERENCES work_handovers (""Id"") ON DELETE SET NULL;
                        END IF;
                        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_IrmPipelineCards_users_OriginalOwnerId') THEN
                            ALTER TABLE ""IrmPipelineCards"" ADD CONSTRAINT ""FK_IrmPipelineCards_users_OriginalOwnerId"" FOREIGN KEY (""OriginalOwnerId"") REFERENCES users (""Id"") ON DELETE RESTRICT;
                        END IF;
                    END IF;

                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'GhlInvestors') THEN
                        ALTER TABLE ""GhlInvestors"" ADD COLUMN IF NOT EXISTS ""HandoverId"" integer;
                        ALTER TABLE ""GhlInvestors"" ADD COLUMN IF NOT EXISTS ""OriginalOwnerId"" integer;
                        CREATE INDEX IF NOT EXISTS ""IX_GhlInvestors_HandoverId"" ON ""GhlInvestors"" (""HandoverId"");
                        CREATE INDEX IF NOT EXISTS ""IX_GhlInvestors_OriginalOwnerId"" ON ""GhlInvestors"" (""OriginalOwnerId"");
                        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_GhlInvestors_work_handovers_HandoverId') THEN
                            ALTER TABLE ""GhlInvestors"" ADD CONSTRAINT ""FK_GhlInvestors_work_handovers_HandoverId"" FOREIGN KEY (""HandoverId"") REFERENCES work_handovers (""Id"") ON DELETE SET NULL;
                        END IF;
                        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_GhlInvestors_users_OriginalOwnerId') THEN
                            ALTER TABLE ""GhlInvestors"" ADD CONSTRAINT ""FK_GhlInvestors_users_OriginalOwnerId"" FOREIGN KEY (""OriginalOwnerId"") REFERENCES users (""Id"") ON DELETE RESTRICT;
                        END IF;
                    END IF;
                END $$;
            ");

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
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
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
        }
    }
}
