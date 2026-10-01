using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class AddKycVerificationFieldsAndPermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotent columns for InvestorKycs
            migrationBuilder.Sql(@"ALTER TABLE ""InvestorKycs"" ADD COLUMN IF NOT EXISTS ""VerifiedBy"" TEXT NULL;");
            migrationBuilder.Sql(@"ALTER TABLE ""InvestorKycs"" ADD COLUMN IF NOT EXISTS ""VerifiedAt"" TIMESTAMP WITH TIME ZONE NULL;");
            migrationBuilder.Sql(@"ALTER TABLE ""InvestorKycs"" ADD COLUMN IF NOT EXISTS ""Remarks"" TEXT NULL;");
            migrationBuilder.Sql(@"ALTER TABLE ""InvestorKycs"" ADD COLUMN IF NOT EXISTS ""FlaggedSectionsJson"" TEXT NULL;");

            // Idempotent columns for GhlDeals (Do NOT duplicate KycStatus)
            migrationBuilder.Sql(@"ALTER TABLE ""GhlDeals"" ADD COLUMN IF NOT EXISTS ""KycId"" INTEGER NULL;");
            migrationBuilder.Sql(@"ALTER TABLE ""GhlDeals"" ADD COLUMN IF NOT EXISTS ""VerifiedBy"" TEXT NULL;");
            migrationBuilder.Sql(@"ALTER TABLE ""GhlDeals"" ADD COLUMN IF NOT EXISTS ""VerifiedAt"" TIMESTAMP WITH TIME ZONE NULL;");
            migrationBuilder.Sql(@"ALTER TABLE ""GhlDeals"" ADD COLUMN IF NOT EXISTS ""Remarks"" TEXT NULL;");
            migrationBuilder.Sql(@"ALTER TABLE ""GhlDeals"" ADD COLUMN IF NOT EXISTS ""FlaggedSections"" TEXT NULL;");

            // Seed kyc.verify to Super Admin (Id 1), Company Admin (Id 2), and IRM (Id 5)
            migrationBuilder.UpdateData(
                table: "roles",
                keyColumn: "Id",
                keyValue: 1,
                column: "Permissions",
                value: new List<string> {
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
                });

            migrationBuilder.UpdateData(
                table: "roles",
                keyColumn: "Id",
                keyValue: 2,
                column: "Permissions",
                value: new List<string> {
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
                });

            migrationBuilder.UpdateData(
                table: "roles",
                keyColumn: "Id",
                keyValue: 5,
                column: "Permissions",
                value: new List<string> {
                    "leads.view", "leads.create", "followups.view", "followups.create", "followups.update",
                    "deals.view", "deals.create", "deals.update",
                    "investors.view", "investors.create", "investors.update",
                    "consultations.view", "consultations.create", "consultations.update",
                    "opportunities.view", "opportunities.create", "opportunities.update",
                    "calls.make", "calls.receive", "calls.view",
                    "reports.view", "chat.view", "chat.send",
                    "kyc.verify"
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "VerifiedBy", table: "InvestorKycs");
            migrationBuilder.DropColumn(name: "VerifiedAt", table: "InvestorKycs");
            migrationBuilder.DropColumn(name: "Remarks", table: "InvestorKycs");
            migrationBuilder.DropColumn(name: "FlaggedSectionsJson", table: "InvestorKycs");

            migrationBuilder.DropColumn(name: "KycId", table: "GhlDeals");
            migrationBuilder.DropColumn(name: "VerifiedBy", table: "GhlDeals");
            migrationBuilder.DropColumn(name: "VerifiedAt", table: "GhlDeals");
            migrationBuilder.DropColumn(name: "Remarks", table: "GhlDeals");
            migrationBuilder.DropColumn(name: "FlaggedSections", table: "GhlDeals");
        }
    }
}
