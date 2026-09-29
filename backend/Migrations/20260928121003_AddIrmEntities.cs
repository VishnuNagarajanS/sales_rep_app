using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class AddIrmEntities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "InvestmentOpportunities",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CompanyId = table.Column<int>(type: "integer", nullable: false),
                    CreatedByIrmId = table.Column<int>(type: "integer", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: false),
                    AssetClass = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    TargetIrr = table.Column<decimal>(type: "numeric", nullable: false),
                    MinTicketSize = table.Column<decimal>(type: "numeric", nullable: false),
                    Tenure = table.Column<string>(type: "text", nullable: false),
                    RiskLevel = table.Column<string>(type: "text", nullable: false),
                    TotalTargetCorpus = table.Column<decimal>(type: "numeric", nullable: false),
                    CommittedAmount = table.Column<decimal>(type: "numeric", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    ClosingDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    BrochureUrl = table.Column<string>(type: "text", nullable: true),
                    FactsheetUrl = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InvestmentOpportunities", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InvestmentOpportunities_tenants_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_InvestmentOpportunities_users_CreatedByIrmId",
                        column: x => x.CreatedByIrmId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Investors",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CompanyId = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Phone = table.Column<string>(type: "text", nullable: false),
                    Email = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    InvestmentCapacity = table.Column<string>(type: "text", nullable: false),
                    PreferredAssetClass = table.Column<string>(type: "text", nullable: false),
                    RiskTolerance = table.Column<string>(type: "text", nullable: true),
                    InvestmentMandate = table.Column<string>(type: "text", nullable: true),
                    CommittedAum = table.Column<string>(type: "text", nullable: true),
                    ReferralSource = table.Column<string>(type: "text", nullable: true),
                    AssignedIrmId = table.Column<int>(type: "integer", nullable: true),
                    AssignedIrmName = table.Column<string>(type: "text", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Investors", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Investors_tenants_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Investors_users_AssignedIrmId",
                        column: x => x.AssignedIrmId,
                        principalTable: "users",
                        principalColumn: "Id");
                });

            migrationBuilder.Sql("DROP TABLE IF EXISTS consultations CASCADE; DROP TABLE IF EXISTS \"Consultations\" CASCADE;");

            migrationBuilder.CreateTable(
                name: "Consultations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    InvestorId = table.Column<int>(type: "integer", nullable: false),
                    CompanyId = table.Column<int>(type: "integer", nullable: false),
                    ConsultantId = table.Column<int>(type: "integer", nullable: false),
                    ConsultantName = table.Column<string>(type: "text", nullable: false),
                    InvestorName = table.Column<string>(type: "text", nullable: false),
                    InvestorPhone = table.Column<string>(type: "text", nullable: false),
                    ScheduledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Agenda = table.Column<string>(type: "text", nullable: false),
                    OutcomeNotes = table.Column<string>(type: "text", nullable: true),
                    ReferredByAgentName = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Consultations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Consultations_Investors_InvestorId",
                        column: x => x.InvestorId,
                        principalTable: "Investors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Consultations_tenants_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Consultations_users_ConsultantId",
                        column: x => x.ConsultantId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.Sql("DROP TABLE IF EXISTS followups CASCADE; DROP TABLE IF EXISTS \"Followups\" CASCADE;");

            migrationBuilder.CreateTable(
                name: "Followups",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CompanyId = table.Column<int>(type: "integer", nullable: false),
                    InvestorId = table.Column<int>(type: "integer", nullable: true),
                    InvestorName = table.Column<string>(type: "text", nullable: true),
                    AssignedToId = table.Column<int>(type: "integer", nullable: false),
                    AssignedToName = table.Column<string>(type: "text", nullable: false),
                    AssignedToRole = table.Column<string>(type: "text", nullable: false),
                    ContactName = table.Column<string>(type: "text", nullable: false),
                    ContactPhone = table.Column<string>(type: "text", nullable: false),
                    ContactId = table.Column<string>(type: "text", nullable: true),
                    ScheduledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Agenda = table.Column<string>(type: "text", nullable: true),
                    OutcomeNotes = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RescheduledTo = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Followups", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Followups_Investors_InvestorId",
                        column: x => x.InvestorId,
                        principalTable: "Investors",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Followups_tenants_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Followups_users_AssignedToId",
                        column: x => x.AssignedToId,
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
                    IrmName = table.Column<string>(type: "text", nullable: false),
                    InvestorName = table.Column<string>(type: "text", nullable: false),
                    InvestorPhone = table.Column<string>(type: "text", nullable: false),
                    CalledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DurationSeconds = table.Column<int>(type: "integer", nullable: false),
                    Outcome = table.Column<int>(type: "integer", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    RecordingUrl = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
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
                name: "InvestorKycs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    InvestorId = table.Column<int>(type: "integer", nullable: false),
                    CompanyId = table.Column<int>(type: "integer", nullable: false),
                    IrmId = table.Column<int>(type: "integer", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    InvestorName = table.Column<string>(type: "text", nullable: false),
                    Phone = table.Column<string>(type: "text", nullable: false),
                    Email = table.Column<string>(type: "text", nullable: false),
                    Gender = table.Column<string>(type: "text", nullable: false),
                    InvestorType = table.Column<string>(type: "text", nullable: false),
                    ResidentType = table.Column<string>(type: "text", nullable: false),
                    Occupation = table.Column<string>(type: "text", nullable: true),
                    PanNumber = table.Column<string>(type: "text", nullable: true),
                    AadhaarNumber = table.Column<string>(type: "text", nullable: true),
                    AddressLine1 = table.Column<string>(type: "text", nullable: true),
                    AddressLine2 = table.Column<string>(type: "text", nullable: true),
                    City = table.Column<string>(type: "text", nullable: true),
                    State = table.Column<string>(type: "text", nullable: true),
                    Pincode = table.Column<string>(type: "text", nullable: true),
                    Country = table.Column<string>(type: "text", nullable: true),
                    BankName = table.Column<string>(type: "text", nullable: true),
                    AccountNumber = table.Column<string>(type: "text", nullable: true),
                    IfscCode = table.Column<string>(type: "text", nullable: true),
                    AccountType = table.Column<string>(type: "text", nullable: true),
                    DematAccountNumber = table.Column<string>(type: "text", nullable: true),
                    DpId = table.Column<string>(type: "text", nullable: true),
                    NomineesJson = table.Column<string>(type: "text", nullable: true),
                    PanDocumentUrl = table.Column<string>(type: "text", nullable: true),
                    AadhaarDocumentUrl = table.Column<string>(type: "text", nullable: true),
                    BankChequeUrl = table.Column<string>(type: "text", nullable: true),
                    DematDocumentUrl = table.Column<string>(type: "text", nullable: true),
                    PhotoUrl = table.Column<string>(type: "text", nullable: true),
                    SignatureUrl = table.Column<string>(type: "text", nullable: true),
                    ReviewRemarks = table.Column<string>(type: "text", nullable: true),
                    ReviewedByIrmId = table.Column<int>(type: "integer", nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SubmittedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    KycLinkToken = table.Column<string>(type: "text", nullable: true),
                    KycLinkExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    KycLinkSent = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InvestorKycs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InvestorKycs_Investors_InvestorId",
                        column: x => x.InvestorId,
                        principalTable: "Investors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_InvestorKycs_tenants_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_InvestorKycs_users_IrmId",
                        column: x => x.IrmId,
                        principalTable: "users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "IrmPipelineCards",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CompanyId = table.Column<int>(type: "integer", nullable: false),
                    InvestorId = table.Column<int>(type: "integer", nullable: false),
                    AssignedIrmId = table.Column<int>(type: "integer", nullable: false),
                    AssignedIrmName = table.Column<string>(type: "text", nullable: false),
                    InvestorName = table.Column<string>(type: "text", nullable: false),
                    InvestorPhone = table.Column<string>(type: "text", nullable: false),
                    InvestorEmail = table.Column<string>(type: "text", nullable: false),
                    StageId = table.Column<string>(type: "text", nullable: false),
                    StageEnteredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastActionSnippet = table.Column<string>(type: "text", nullable: true),
                    LastActivityDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Priority = table.Column<string>(type: "text", nullable: false),
                    Value = table.Column<decimal>(type: "numeric", nullable: true),
                    InvestmentAmount = table.Column<string>(type: "text", nullable: true),
                    PreferredAssetClass = table.Column<string>(type: "text", nullable: true),
                    ActivityLogsJson = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
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
                    OpportunityId = table.Column<int>(type: "integer", nullable: false),
                    InvestorId = table.Column<int>(type: "integer", nullable: false),
                    PitchedByIrmId = table.Column<int>(type: "integer", nullable: false),
                    PitchedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    PitchNotes = table.Column<string>(type: "text", nullable: true),
                    IsCommitted = table.Column<bool>(type: "boolean", nullable: false),
                    CommittedAmount = table.Column<decimal>(type: "numeric", nullable: true),
                    CommittedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CommitmentNotes = table.Column<string>(type: "text", nullable: true)
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
                table: "InvestmentOpportunities",
                columns: new[] { "Id", "AssetClass", "BrochureUrl", "ClosingDate", "CommittedAmount", "CompanyId", "CreatedAt", "CreatedByIrmId", "Description", "FactsheetUrl", "IsActive", "MinTicketSize", "RiskLevel", "TargetIrr", "Tenure", "Title", "TotalTargetCorpus", "UpdatedAt" },
                values: new object[] { 1, "Commercial AIF", null, null, 50000000m, 1, new DateTime(2026, 1, 10, 0, 0, 0, 0, DateTimeKind.Utc), 2, "Grade-A office park pre-leased to Fortune 500 GCCs with 8.5% entry cap rate", null, true, 10000000m, "Moderate", 16.5m, "5 Years", "Prime Bengaluru Commercial Yield Fund II", 1000000000m, null });

            migrationBuilder.InsertData(
                table: "Investors",
                columns: new[] { "Id", "AssignedIrmId", "AssignedIrmName", "CommittedAum", "CompanyId", "CreatedAt", "Email", "InvestmentCapacity", "InvestmentMandate", "Name", "Notes", "Phone", "PreferredAssetClass", "ReferralSource", "RiskTolerance", "Status", "UpdatedAt" },
                values: new object[,]
                {
                    { 1, 2, "Vikram Malhotra", "₹5.0 Cr", 1, new DateTime(2026, 1, 15, 0, 0, 0, 0, DateTimeKind.Utc), "rajesh.singhania@apexcapital.in", "₹5 Cr – ₹10 Cr", "Growth focused Category II AIF with commercial allocation", "Rajesh Singhania", "Senior HNI investor with portfolio in Bangalore", "+91 98200 44556", "AIF", "Wealth Partner Direct", "Moderate", 1, null },
                    { 2, 2, "Vikram Malhotra", null, 1, new DateTime(2026, 2, 1, 0, 0, 0, 0, DateTimeKind.Utc), "meera.nambiar@nambiarholdings.com", "₹10 Cr – ₹25 Cr", "High-yield commercial development tranches", "Meera Nambiar", "Family office lead referred via CFO network", "+91 98450 99881", "Commercial AIF", null, "Aggressive", 0, null }
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

            // migrationBuilder.InsertData for roles omitted to prevent duplicate key error

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
                    { 1, null, 2, "Vikram Malhotra", 1, new DateTime(2026, 1, 15, 0, 0, 0, 0, DateTimeKind.Utc), "₹5 Cr", "rajesh.singhania@apexcapital.in", 1, "Rajesh Singhania", "+91 98200 44556", null, null, "AIF", "High", new DateTime(2026, 2, 10, 0, 0, 0, 0, DateTimeKind.Utc), "qualified_investor", null, 50000000m },
                    { 2, null, 2, "Vikram Malhotra", 1, new DateTime(2026, 2, 1, 0, 0, 0, 0, DateTimeKind.Utc), "₹10 Cr", "meera.nambiar@nambiarholdings.com", 2, "Meera Nambiar", "+91 98450 99881", null, null, "Commercial AIF", "High", new DateTime(2026, 2, 1, 0, 0, 0, 0, DateTimeKind.Utc), "leads", null, 100000000m }
                });

            // migrationBuilder.InsertData(
            //     table: "users",
            //     columns: new[] { "Id", "AvatarUrl", "CompanyId", "CreatedAt", "Email", "LastLoginAt", "Name", "PasswordHash", "Phone", "RoleId", "UpdatedAt" },
            //     values: new object[,]
            //     {
            //         { 5, null, 1, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "rohan.varma@ghlindiatrust.com", null, "Rohan Varma", "$2a$11$z2c3Nc1pe7Tqmxj6Rm15NOt8vuAyyKfqzGtBKpiFU2NcPZxsjt5p.", "+91 98110 77889", 5, null },
            //         { 6, null, 1, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "priya.irm@ghlindiatrust.com", null, "Priya Sharma", "$2a$11$z2c3Nc1pe7Tqmxj6Rm15NOt8vuAyyKfqzGtBKpiFU2NcPZxsjt5p.", "+91 98450 66778", 5, null }
            //     });

            migrationBuilder.CreateIndex(
                name: "IX_Consultations_CompanyId",
                table: "Consultations",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_Consultations_ConsultantId",
                table: "Consultations",
                column: "ConsultantId");

            migrationBuilder.CreateIndex(
                name: "IX_Consultations_InvestorId",
                table: "Consultations",
                column: "InvestorId");

            migrationBuilder.CreateIndex(
                name: "IX_Followups_AssignedToId",
                table: "Followups",
                column: "AssignedToId");

            migrationBuilder.CreateIndex(
                name: "IX_Followups_CompanyId",
                table: "Followups",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_Followups_InvestorId",
                table: "Followups",
                column: "InvestorId");

            migrationBuilder.CreateIndex(
                name: "IX_InvestmentOpportunities_CompanyId",
                table: "InvestmentOpportunities",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_InvestmentOpportunities_CreatedByIrmId",
                table: "InvestmentOpportunities",
                column: "CreatedByIrmId");

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
                name: "IX_InvestorKycs_CompanyId",
                table: "InvestorKycs",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_InvestorKycs_InvestorId",
                table: "InvestorKycs",
                column: "InvestorId");

            migrationBuilder.CreateIndex(
                name: "IX_InvestorKycs_IrmId",
                table: "InvestorKycs",
                column: "IrmId");

            migrationBuilder.CreateIndex(
                name: "IX_Investors_AssignedIrmId",
                table: "Investors",
                column: "AssignedIrmId");

            migrationBuilder.CreateIndex(
                name: "IX_Investors_CompanyId",
                table: "Investors",
                column: "CompanyId");

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
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Consultations");

            migrationBuilder.DropTable(
                name: "Followups");

            migrationBuilder.DropTable(
                name: "InvestorCalls");

            migrationBuilder.DropTable(
                name: "InvestorKycs");

            migrationBuilder.DropTable(
                name: "IrmPipelineCards");

            migrationBuilder.DropTable(
                name: "OpportunityPitches");

            migrationBuilder.DropTable(
                name: "InvestmentOpportunities");

            migrationBuilder.DropTable(
                name: "Investors");

            migrationBuilder.DeleteData(
                table: "users",
                keyColumn: "Id",
                keyValue: 5);

            migrationBuilder.DeleteData(
                table: "users",
                keyColumn: "Id",
                keyValue: 6);

            migrationBuilder.DeleteData(
                table: "roles",
                keyColumn: "Id",
                keyValue: 5);

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
