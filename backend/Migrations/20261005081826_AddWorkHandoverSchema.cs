using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkHandoverSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {

            migrationBuilder.AddColumn<int>(
                name: "HandoverId",
                table: "leads",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OriginalOwnerId",
                table: "leads",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "HandoverId",
                table: "IrmPipelineCards",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OriginalOwnerId",
                table: "IrmPipelineCards",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "HandoverId",
                table: "Investors",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OriginalOwnerId",
                table: "Investors",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "HandoverId",
                table: "InvestorKycs",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OriginalOwnerId",
                table: "InvestorKycs",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "HandoverId",
                table: "GhlInvestors",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OriginalOwnerId",
                table: "GhlInvestors",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "HandoverId",
                table: "GhlInvestmentOpportunities",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OriginalOwnerId",
                table: "GhlInvestmentOpportunities",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "HandoverId",
                table: "GhlDeals",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OriginalOwnerId",
                table: "GhlDeals",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "HandoverId",
                table: "followups",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OriginalOwnerId",
                table: "followups",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "HandoverId",
                table: "customers",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OriginalOwnerId",
                table: "customers",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "HandoverId",
                table: "consultations",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OriginalOwnerId",
                table: "consultations",
                type: "integer",
                nullable: true);


            migrationBuilder.CreateTable(
                name: "work_handovers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CompanyId = table.Column<int>(type: "integer", nullable: false),
                    RoleCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    OriginalUserId = table.Column<int>(type: "integer", nullable: false),
                    CoveringUserId = table.Column<int>(type: "integer", nullable: false),
                    StartedById = table.Column<int>(type: "integer", nullable: false),
                    Reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    StartedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    PlannedEndAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false, defaultValue: "active"),
                    EndedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    EndedById = table.Column<int>(type: "integer", nullable: true),
                    ReturnSummaryJson = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_work_handovers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_work_handovers_tenants_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_work_handovers_users_CoveringUserId",
                        column: x => x.CoveringUserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_work_handovers_users_EndedById",
                        column: x => x.EndedById,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_work_handovers_users_OriginalUserId",
                        column: x => x.OriginalUserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_work_handovers_users_StartedById",
                        column: x => x.StartedById,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "work_handover_items",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    HandoverId = table.Column<int>(type: "integer", nullable: false),
                    EntityType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    EntityId = table.Column<int>(type: "integer", nullable: false),
                    Origin = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false, defaultValue: "included_at_start"),
                    ReturnedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReturnOutcome = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_work_handover_items", x => x.Id);
                    table.ForeignKey(
                        name: "FK_work_handover_items_work_handovers_HandoverId",
                        column: x => x.HandoverId,
                        principalTable: "work_handovers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.UpdateData(
                table: "Investors",
                keyColumn: "Id",
                keyValue: 1,
                columns: new[] { "HandoverId", "OriginalOwnerId" },
                values: new object[] { null, null });

            migrationBuilder.UpdateData(
                table: "Investors",
                keyColumn: "Id",
                keyValue: 2,
                columns: new[] { "HandoverId", "OriginalOwnerId" },
                values: new object[] { null, null });

            migrationBuilder.UpdateData(
                table: "IrmPipelineCards",
                keyColumn: "Id",
                keyValue: 1,
                columns: new[] { "HandoverId", "OriginalOwnerId" },
                values: new object[] { null, null });

            migrationBuilder.UpdateData(
                table: "IrmPipelineCards",
                keyColumn: "Id",
                keyValue: 2,
                columns: new[] { "HandoverId", "OriginalOwnerId" },
                values: new object[] { null, null });


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

            migrationBuilder.CreateIndex(
                name: "IX_leads_AssignedAgentId",
                table: "leads",
                column: "AssignedAgentId");

            migrationBuilder.CreateIndex(
                name: "IX_leads_HandoverId",
                table: "leads",
                column: "HandoverId");

            migrationBuilder.CreateIndex(
                name: "IX_leads_OriginalOwnerId",
                table: "leads",
                column: "OriginalOwnerId");

            migrationBuilder.CreateIndex(
                name: "IX_IrmPipelineCards_HandoverId",
                table: "IrmPipelineCards",
                column: "HandoverId");

            migrationBuilder.CreateIndex(
                name: "IX_IrmPipelineCards_OriginalOwnerId",
                table: "IrmPipelineCards",
                column: "OriginalOwnerId");

            migrationBuilder.CreateIndex(
                name: "IX_Investors_HandoverId",
                table: "Investors",
                column: "HandoverId");

            migrationBuilder.CreateIndex(
                name: "IX_Investors_OriginalOwnerId",
                table: "Investors",
                column: "OriginalOwnerId");

            migrationBuilder.CreateIndex(
                name: "IX_InvestorKycs_HandoverId",
                table: "InvestorKycs",
                column: "HandoverId");

            migrationBuilder.CreateIndex(
                name: "IX_InvestorKycs_OriginalOwnerId",
                table: "InvestorKycs",
                column: "OriginalOwnerId");

            migrationBuilder.CreateIndex(
                name: "IX_GhlInvestors_HandoverId",
                table: "GhlInvestors",
                column: "HandoverId");

            migrationBuilder.CreateIndex(
                name: "IX_GhlInvestors_OriginalOwnerId",
                table: "GhlInvestors",
                column: "OriginalOwnerId");

            migrationBuilder.CreateIndex(
                name: "IX_GhlInvestmentOpportunities_HandoverId",
                table: "GhlInvestmentOpportunities",
                column: "HandoverId");

            migrationBuilder.CreateIndex(
                name: "IX_GhlInvestmentOpportunities_OriginalOwnerId",
                table: "GhlInvestmentOpportunities",
                column: "OriginalOwnerId");

            migrationBuilder.CreateIndex(
                name: "IX_GhlDeals_HandoverId",
                table: "GhlDeals",
                column: "HandoverId");

            migrationBuilder.CreateIndex(
                name: "IX_GhlDeals_OriginalOwnerId",
                table: "GhlDeals",
                column: "OriginalOwnerId");

            migrationBuilder.CreateIndex(
                name: "IX_followups_HandoverId",
                table: "followups",
                column: "HandoverId");

            migrationBuilder.CreateIndex(
                name: "IX_followups_OriginalOwnerId",
                table: "followups",
                column: "OriginalOwnerId");

            migrationBuilder.CreateIndex(
                name: "IX_customers_HandoverId",
                table: "customers",
                column: "HandoverId");

            migrationBuilder.CreateIndex(
                name: "IX_customers_OriginalOwnerId",
                table: "customers",
                column: "OriginalOwnerId");

            migrationBuilder.CreateIndex(
                name: "IX_consultations_HandoverId",
                table: "consultations",
                column: "HandoverId");

            migrationBuilder.CreateIndex(
                name: "IX_consultations_OriginalOwnerId",
                table: "consultations",
                column: "OriginalOwnerId");


            migrationBuilder.CreateIndex(
                name: "IX_work_handover_items_HandoverId_EntityType_EntityId",
                table: "work_handover_items",
                columns: new[] { "HandoverId", "EntityType", "EntityId" });

            migrationBuilder.CreateIndex(
                name: "IX_work_handovers_CompanyId_CoveringUserId_Status",
                table: "work_handovers",
                columns: new[] { "CompanyId", "CoveringUserId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_work_handovers_CompanyId_OriginalUserId_Status",
                table: "work_handovers",
                columns: new[] { "CompanyId", "OriginalUserId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_work_handovers_CompanyId_RoleCode_Status",
                table: "work_handovers",
                columns: new[] { "CompanyId", "RoleCode", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_work_handovers_CoveringUserId",
                table: "work_handovers",
                column: "CoveringUserId");

            migrationBuilder.CreateIndex(
                name: "IX_work_handovers_EndedById",
                table: "work_handovers",
                column: "EndedById");

            migrationBuilder.CreateIndex(
                name: "IX_work_handovers_OriginalUserId",
                table: "work_handovers",
                column: "OriginalUserId");

            migrationBuilder.CreateIndex(
                name: "IX_work_handovers_StartedById",
                table: "work_handovers",
                column: "StartedById");

            migrationBuilder.AddForeignKey(
                name: "FK_consultations_users_OriginalOwnerId",
                table: "consultations",
                column: "OriginalOwnerId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_consultations_work_handovers_HandoverId",
                table: "consultations",
                column: "HandoverId",
                principalTable: "work_handovers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_customers_users_OriginalOwnerId",
                table: "customers",
                column: "OriginalOwnerId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_customers_work_handovers_HandoverId",
                table: "customers",
                column: "HandoverId",
                principalTable: "work_handovers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_followups_users_OriginalOwnerId",
                table: "followups",
                column: "OriginalOwnerId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_followups_work_handovers_HandoverId",
                table: "followups",
                column: "HandoverId",
                principalTable: "work_handovers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_GhlDeals_users_OriginalOwnerId",
                table: "GhlDeals",
                column: "OriginalOwnerId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_GhlDeals_work_handovers_HandoverId",
                table: "GhlDeals",
                column: "HandoverId",
                principalTable: "work_handovers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_GhlInvestmentOpportunities_users_OriginalOwnerId",
                table: "GhlInvestmentOpportunities",
                column: "OriginalOwnerId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_GhlInvestmentOpportunities_work_handovers_HandoverId",
                table: "GhlInvestmentOpportunities",
                column: "HandoverId",
                principalTable: "work_handovers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_GhlInvestors_users_OriginalOwnerId",
                table: "GhlInvestors",
                column: "OriginalOwnerId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_GhlInvestors_work_handovers_HandoverId",
                table: "GhlInvestors",
                column: "HandoverId",
                principalTable: "work_handovers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_InvestorKycs_users_OriginalOwnerId",
                table: "InvestorKycs",
                column: "OriginalOwnerId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_InvestorKycs_work_handovers_HandoverId",
                table: "InvestorKycs",
                column: "HandoverId",
                principalTable: "work_handovers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Investors_users_OriginalOwnerId",
                table: "Investors",
                column: "OriginalOwnerId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Investors_work_handovers_HandoverId",
                table: "Investors",
                column: "HandoverId",
                principalTable: "work_handovers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_IrmPipelineCards_users_OriginalOwnerId",
                table: "IrmPipelineCards",
                column: "OriginalOwnerId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_IrmPipelineCards_work_handovers_HandoverId",
                table: "IrmPipelineCards",
                column: "HandoverId",
                principalTable: "work_handovers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_leads_users_OriginalOwnerId",
                table: "leads",
                column: "OriginalOwnerId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_leads_work_handovers_HandoverId",
                table: "leads",
                column: "HandoverId",
                principalTable: "work_handovers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_consultations_users_OriginalOwnerId",
                table: "consultations");

            migrationBuilder.DropForeignKey(
                name: "FK_consultations_work_handovers_HandoverId",
                table: "consultations");

            migrationBuilder.DropForeignKey(
                name: "FK_customers_users_OriginalOwnerId",
                table: "customers");

            migrationBuilder.DropForeignKey(
                name: "FK_customers_work_handovers_HandoverId",
                table: "customers");

            migrationBuilder.DropForeignKey(
                name: "FK_followups_users_OriginalOwnerId",
                table: "followups");

            migrationBuilder.DropForeignKey(
                name: "FK_followups_work_handovers_HandoverId",
                table: "followups");

            migrationBuilder.DropForeignKey(
                name: "FK_GhlDeals_users_OriginalOwnerId",
                table: "GhlDeals");

            migrationBuilder.DropForeignKey(
                name: "FK_GhlDeals_work_handovers_HandoverId",
                table: "GhlDeals");

            migrationBuilder.DropForeignKey(
                name: "FK_GhlInvestmentOpportunities_users_OriginalOwnerId",
                table: "GhlInvestmentOpportunities");

            migrationBuilder.DropForeignKey(
                name: "FK_GhlInvestmentOpportunities_work_handovers_HandoverId",
                table: "GhlInvestmentOpportunities");

            migrationBuilder.DropForeignKey(
                name: "FK_GhlInvestors_users_OriginalOwnerId",
                table: "GhlInvestors");

            migrationBuilder.DropForeignKey(
                name: "FK_GhlInvestors_work_handovers_HandoverId",
                table: "GhlInvestors");

            migrationBuilder.DropForeignKey(
                name: "FK_InvestorKycs_users_OriginalOwnerId",
                table: "InvestorKycs");

            migrationBuilder.DropForeignKey(
                name: "FK_InvestorKycs_work_handovers_HandoverId",
                table: "InvestorKycs");

            migrationBuilder.DropForeignKey(
                name: "FK_Investors_users_OriginalOwnerId",
                table: "Investors");

            migrationBuilder.DropForeignKey(
                name: "FK_Investors_work_handovers_HandoverId",
                table: "Investors");

            migrationBuilder.DropForeignKey(
                name: "FK_IrmPipelineCards_users_OriginalOwnerId",
                table: "IrmPipelineCards");

            migrationBuilder.DropForeignKey(
                name: "FK_IrmPipelineCards_work_handovers_HandoverId",
                table: "IrmPipelineCards");

            migrationBuilder.DropForeignKey(
                name: "FK_leads_users_OriginalOwnerId",
                table: "leads");

            migrationBuilder.DropForeignKey(
                name: "FK_leads_work_handovers_HandoverId",
                table: "leads");


            migrationBuilder.DropTable(
                name: "work_handover_items");

            migrationBuilder.DropTable(
                name: "work_handovers");

            migrationBuilder.DropIndex(
                name: "IX_leads_AssignedAgentId",
                table: "leads");

            migrationBuilder.DropIndex(
                name: "IX_leads_HandoverId",
                table: "leads");

            migrationBuilder.DropIndex(
                name: "IX_leads_OriginalOwnerId",
                table: "leads");

            migrationBuilder.DropIndex(
                name: "IX_IrmPipelineCards_HandoverId",
                table: "IrmPipelineCards");

            migrationBuilder.DropIndex(
                name: "IX_IrmPipelineCards_OriginalOwnerId",
                table: "IrmPipelineCards");

            migrationBuilder.DropIndex(
                name: "IX_Investors_HandoverId",
                table: "Investors");

            migrationBuilder.DropIndex(
                name: "IX_Investors_OriginalOwnerId",
                table: "Investors");

            migrationBuilder.DropIndex(
                name: "IX_InvestorKycs_HandoverId",
                table: "InvestorKycs");

            migrationBuilder.DropIndex(
                name: "IX_InvestorKycs_OriginalOwnerId",
                table: "InvestorKycs");

            migrationBuilder.DropIndex(
                name: "IX_GhlInvestors_HandoverId",
                table: "GhlInvestors");

            migrationBuilder.DropIndex(
                name: "IX_GhlInvestors_OriginalOwnerId",
                table: "GhlInvestors");

            migrationBuilder.DropIndex(
                name: "IX_GhlInvestmentOpportunities_HandoverId",
                table: "GhlInvestmentOpportunities");

            migrationBuilder.DropIndex(
                name: "IX_GhlInvestmentOpportunities_OriginalOwnerId",
                table: "GhlInvestmentOpportunities");

            migrationBuilder.DropIndex(
                name: "IX_GhlDeals_HandoverId",
                table: "GhlDeals");

            migrationBuilder.DropIndex(
                name: "IX_GhlDeals_OriginalOwnerId",
                table: "GhlDeals");

            migrationBuilder.DropIndex(
                name: "IX_followups_HandoverId",
                table: "followups");

            migrationBuilder.DropIndex(
                name: "IX_followups_OriginalOwnerId",
                table: "followups");

            migrationBuilder.DropIndex(
                name: "IX_customers_HandoverId",
                table: "customers");

            migrationBuilder.DropIndex(
                name: "IX_customers_OriginalOwnerId",
                table: "customers");

            migrationBuilder.DropIndex(
                name: "IX_consultations_HandoverId",
                table: "consultations");

            migrationBuilder.DropIndex(
                name: "IX_consultations_OriginalOwnerId",
                table: "consultations");

            migrationBuilder.DropColumn(
                name: "HandoverId",
                table: "leads");

            migrationBuilder.DropColumn(
                name: "OriginalOwnerId",
                table: "leads");

            migrationBuilder.DropColumn(
                name: "HandoverId",
                table: "IrmPipelineCards");

            migrationBuilder.DropColumn(
                name: "OriginalOwnerId",
                table: "IrmPipelineCards");

            migrationBuilder.DropColumn(
                name: "HandoverId",
                table: "Investors");

            migrationBuilder.DropColumn(
                name: "OriginalOwnerId",
                table: "Investors");

            migrationBuilder.DropColumn(
                name: "HandoverId",
                table: "InvestorKycs");

            migrationBuilder.DropColumn(
                name: "OriginalOwnerId",
                table: "InvestorKycs");

            migrationBuilder.DropColumn(
                name: "HandoverId",
                table: "GhlInvestors");

            migrationBuilder.DropColumn(
                name: "OriginalOwnerId",
                table: "GhlInvestors");

            migrationBuilder.DropColumn(
                name: "HandoverId",
                table: "GhlInvestmentOpportunities");

            migrationBuilder.DropColumn(
                name: "OriginalOwnerId",
                table: "GhlInvestmentOpportunities");

            migrationBuilder.DropColumn(
                name: "HandoverId",
                table: "GhlDeals");

            migrationBuilder.DropColumn(
                name: "OriginalOwnerId",
                table: "GhlDeals");

            migrationBuilder.DropColumn(
                name: "HandoverId",
                table: "followups");

            migrationBuilder.DropColumn(
                name: "OriginalOwnerId",
                table: "followups");

            migrationBuilder.DropColumn(
                name: "HandoverId",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "OriginalOwnerId",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "HandoverId",
                table: "consultations");

            migrationBuilder.DropColumn(
                name: "OriginalOwnerId",
                table: "consultations");

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

            migrationBuilder.InsertData(
                table: "AuditLogs",
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
                column: "EnabledFeatures",
                value: new List<string> { "leads", "customers", "deals", "followups", "calls", "call-recording", "call-transcription", "investors", "consultations", "investment-opportunities", "reports", "users", "roles", "company-settings", "audit-logs" });

            migrationBuilder.UpdateData(
                table: "tenants",
                keyColumn: "Id",
                keyValue: 2,
                column: "EnabledFeatures",
                value: new List<string> { "leads", "customers", "deals", "followups", "calls", "call-recording", "call-transcription", "properties", "site-visits", "bookings", "reports", "users", "roles", "company-settings", "audit-logs" });

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_TargetTenantId",
                table: "AuditLogs",
                column: "TargetTenantId");

            migrationBuilder.AddForeignKey(
                name: "FK_AuditLogs_tenants_TargetTenantId",
                table: "AuditLogs",
                column: "TargetTenantId",
                principalTable: "tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}
