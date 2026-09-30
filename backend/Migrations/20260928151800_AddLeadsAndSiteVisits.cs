using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class AddLeadsAndSiteVisits : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "leads",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TenantId = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Phone = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Email = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    Location = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    Source = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false, defaultValue: "New"),
                    Priority = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false, defaultValue: "Medium"),
                    AssignedAgentId = table.Column<int>(type: "integer", nullable: true),
                    AssignedAgentName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    TargetDevelopment = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    PreferredVisitDate = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    PreferredTimeSlot = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    AnythingWeShouldKnow = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    WhatAreYouLookingFor = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    BudgetRange = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ReadyToRegister = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    InvestmentCapacity = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    AssetClass = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Horizon = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    InvestorType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Notes = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_leads", x => x.Id);
                    table.ForeignKey(
                        name: "FK_leads_tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "site_visits",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TenantId = table.Column<int>(type: "integer", nullable: false),
                    LeadId = table.Column<int>(type: "integer", nullable: false),
                    ProjectName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    PlotNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ScheduledAt = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    AssignedAgentId = table.Column<int>(type: "integer", nullable: true),
                    AssignedAgentName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    Status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false, defaultValue: "Scheduled"),
                    OutcomeNotes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_site_visits", x => x.Id);
                    table.ForeignKey(
                        name: "FK_site_visits_leads_LeadId",
                        column: x => x.LeadId,
                        principalTable: "leads",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_site_visits_tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "users",
                columns: new[] { "Id", "CompanyId", "CreatedAt", "Email", "Name", "PasswordHash", "Phone", "RoleId", "Status" },
                values: new object[] { 5, 2, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "pooja@jaminbazaar.com", "Pooja Hegde", "$2a$11$z2c3Nc1pe7Tqmxj6Rm15NOt8vuAyyKfqzGtBKpiFU2NcPZxsjt5p.", "+91 99160 44889", 4, "Active" });

            migrationBuilder.CreateIndex(
                name: "IX_leads_Status",
                table: "leads",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_leads_TenantId_Phone",
                table: "leads",
                columns: new[] { "TenantId", "Phone" });

            migrationBuilder.CreateIndex(
                name: "IX_site_visits_LeadId",
                table: "site_visits",
                column: "LeadId");

            migrationBuilder.CreateIndex(
                name: "IX_site_visits_Status",
                table: "site_visits",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_site_visits_TenantId",
                table: "site_visits",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "site_visits");

            migrationBuilder.DropTable(
                name: "leads");

            migrationBuilder.DeleteData(
                table: "users",
                keyColumn: "Id",
                keyValue: 5);
        }
    }
}
