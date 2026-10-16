using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class AddChatTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AuditLogs_tenants_CompanyId",
                table: "AuditLogs");

            migrationBuilder.DropForeignKey(
                name: "FK_consultations_Investors_InvestorId",
                table: "consultations");

            migrationBuilder.DropTable(
                name: "GhlInvestors");

            migrationBuilder.DropTable(
                name: "InvestorCalls");

            migrationBuilder.DropTable(
                name: "IrmPipelineCards");

            migrationBuilder.DropTable(
                name: "OpportunityPitches");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Notifications",
                table: "Notifications");

            migrationBuilder.DropPrimaryKey(
                name: "PK_AuditLogs",
                table: "AuditLogs");

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
                name: "InterestedLeadSince",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "SourceLeadId",
                table: "customers");

            migrationBuilder.RenameTable(
                name: "Notifications",
                newName: "notifications");

            migrationBuilder.RenameTable(
                name: "AuditLogs",
                newName: "audit_logs");

            migrationBuilder.RenameIndex(
                name: "IX_AuditLogs_CompanyId",
                table: "audit_logs",
                newName: "IX_audit_logs_CompanyId");

            migrationBuilder.AlterColumn<string>(
                name: "ContactEmail",
                table: "followups",
                type: "character varying(255)",
                maxLength: 255,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(255)",
                oldMaxLength: 255);

            migrationBuilder.AlterColumn<int>(
                name: "Status",
                table: "consultations",
                type: "integer",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer",
                oldDefaultValue: 0);

            migrationBuilder.AlterColumn<int>(
                name: "InvestorId",
                table: "consultations",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AddPrimaryKey(
                name: "PK_notifications",
                table: "notifications",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_audit_logs",
                table: "audit_logs",
                column: "Id");

            migrationBuilder.CreateTable(
                name: "ChatConversations",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    CompanyId = table.Column<int>(type: "integer", nullable: false),
                    Type = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: true),
                    Description = table.Column<string>(type: "text", nullable: true),
                    CreatedByUserId = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChatConversations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ChatMessages",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    ConversationId = table.Column<string>(type: "text", nullable: false),
                    SenderId = table.Column<int>(type: "integer", nullable: false),
                    SenderName = table.Column<string>(type: "text", nullable: false),
                    Content = table.Column<string>(type: "text", nullable: false),
                    MessageType = table.Column<string>(type: "text", nullable: false),
                    ReplyToMessageId = table.Column<string>(type: "text", nullable: true),
                    IsEdited = table.Column<bool>(type: "boolean", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    ReactionsJson = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChatMessages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ChatMessages_ChatConversations_ConversationId",
                        column: x => x.ConversationId,
                        principalTable: "ChatConversations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ChatParticipants",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ConversationId = table.Column<string>(type: "text", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    JoinedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastReadMessageId = table.Column<string>(type: "text", nullable: true),
                    IsPinned = table.Column<bool>(type: "boolean", nullable: false),
                    IsMuted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChatParticipants", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ChatParticipants_ChatConversations_ConversationId",
                        column: x => x.ConversationId,
                        principalTable: "ChatConversations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ChatParticipants_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ChatAttachments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    MessageId = table.Column<string>(type: "text", nullable: false),
                    FileName = table.Column<string>(type: "text", nullable: false),
                    FileUrl = table.Column<string>(type: "text", nullable: false),
                    FileSize = table.Column<long>(type: "bigint", nullable: false),
                    MimeType = table.Column<string>(type: "text", nullable: false),
                    Category = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChatAttachments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ChatAttachments_ChatMessages_MessageId",
                        column: x => x.MessageId,
                        principalTable: "ChatMessages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
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

            migrationBuilder.CreateIndex(
                name: "IX_ChatAttachments_MessageId",
                table: "ChatAttachments",
                column: "MessageId");

            migrationBuilder.CreateIndex(
                name: "IX_ChatConversations_CompanyId_Type",
                table: "ChatConversations",
                columns: new[] { "CompanyId", "Type" });

            migrationBuilder.CreateIndex(
                name: "IX_ChatMessages_ConversationId_CreatedAt",
                table: "ChatMessages",
                columns: new[] { "ConversationId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ChatParticipants_ConversationId_UserId",
                table: "ChatParticipants",
                columns: new[] { "ConversationId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ChatParticipants_UserId",
                table: "ChatParticipants",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_audit_logs_tenants_CompanyId",
                table: "audit_logs",
                column: "CompanyId",
                principalTable: "tenants",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_consultations_Investors_InvestorId",
                table: "consultations",
                column: "InvestorId",
                principalTable: "Investors",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_GhlInvestmentOpportunities_work_handovers_HandoverId",
                table: "GhlInvestmentOpportunities",
                column: "HandoverId",
                principalTable: "work_handovers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_audit_logs_tenants_CompanyId",
                table: "audit_logs");

            migrationBuilder.DropForeignKey(
                name: "FK_consultations_Investors_InvestorId",
                table: "consultations");

            migrationBuilder.DropForeignKey(
                name: "FK_GhlInvestmentOpportunities_work_handovers_HandoverId",
                table: "GhlInvestmentOpportunities");

            migrationBuilder.DropTable(
                name: "ChatAttachments");

            migrationBuilder.DropTable(
                name: "ChatParticipants");

            migrationBuilder.DropTable(
                name: "ChatMessages");

            migrationBuilder.DropTable(
                name: "ChatConversations");

            migrationBuilder.DropPrimaryKey(
                name: "PK_notifications",
                table: "notifications");

            migrationBuilder.DropPrimaryKey(
                name: "PK_audit_logs",
                table: "audit_logs");

            migrationBuilder.RenameTable(
                name: "notifications",
                newName: "Notifications");

            migrationBuilder.RenameTable(
                name: "audit_logs",
                newName: "AuditLogs");

            migrationBuilder.RenameIndex(
                name: "IX_audit_logs_CompanyId",
                table: "AuditLogs",
                newName: "IX_AuditLogs_CompanyId");

            migrationBuilder.AlterColumn<string>(
                name: "ContactEmail",
                table: "followups",
                type: "character varying(255)",
                maxLength: 255,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "character varying(255)",
                oldMaxLength: 255,
                oldNullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "InterestedLeadSince",
                table: "customers",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "customers",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "SourceLeadId",
                table: "customers",
                type: "integer",
                nullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "Status",
                table: "consultations",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AlterColumn<int>(
                name: "InvestorId",
                table: "consultations",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AddPrimaryKey(
                name: "PK_Notifications",
                table: "Notifications",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_AuditLogs",
                table: "AuditLogs",
                column: "Id");

            migrationBuilder.CreateTable(
                name: "GhlInvestors",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    AssignedAgentId = table.Column<int>(type: "integer", nullable: false),
                    CompanyId = table.Column<int>(type: "integer", nullable: false),
                    HandoverId = table.Column<int>(type: "integer", nullable: true),
                    OriginalOwnerId = table.Column<int>(type: "integer", nullable: true),
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
                    table.ForeignKey(
                        name: "FK_GhlInvestors_users_OriginalOwnerId",
                        column: x => x.OriginalOwnerId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_GhlInvestors_work_handovers_HandoverId",
                        column: x => x.HandoverId,
                        principalTable: "work_handovers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "InvestorCalls",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CalledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CompanyId = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DurationSeconds = table.Column<int>(type: "integer", nullable: false),
                    InvestorId = table.Column<int>(type: "integer", nullable: false),
                    InvestorName = table.Column<string>(type: "text", nullable: false),
                    InvestorPhone = table.Column<string>(type: "text", nullable: false),
                    IrmId = table.Column<int>(type: "integer", nullable: false),
                    IrmName = table.Column<string>(type: "text", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    Outcome = table.Column<int>(type: "integer", nullable: false),
                    RecordingUrl = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InvestorCalls", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "IrmPipelineCards",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    AssignedIrmId = table.Column<int>(type: "integer", nullable: false),
                    CompanyId = table.Column<int>(type: "integer", nullable: false),
                    HandoverId = table.Column<int>(type: "integer", nullable: true),
                    InvestorId = table.Column<int>(type: "integer", nullable: false),
                    OriginalOwnerId = table.Column<int>(type: "integer", nullable: true),
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
                    table.ForeignKey(
                        name: "FK_IrmPipelineCards_users_OriginalOwnerId",
                        column: x => x.OriginalOwnerId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_IrmPipelineCards_work_handovers_HandoverId",
                        column: x => x.HandoverId,
                        principalTable: "work_handovers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "OpportunityPitches",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CommitmentNotes = table.Column<string>(type: "text", nullable: true),
                    CommittedAmount = table.Column<decimal>(type: "numeric", nullable: true),
                    CommittedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    InvestorId = table.Column<int>(type: "integer", nullable: false),
                    IsCommitted = table.Column<bool>(type: "boolean", nullable: false),
                    OpportunityId = table.Column<int>(type: "integer", nullable: false),
                    PitchNotes = table.Column<string>(type: "text", nullable: true),
                    PitchedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    PitchedByIrmId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OpportunityPitches", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "InvestmentOpportunities",
                columns: new[] { "Id", "AssetClass", "BrochureUrl", "ClosingDate", "CommittedAmount", "CompanyId", "CreatedAt", "CreatedByIrmId", "Description", "FactsheetUrl", "IsActive", "MinTicketSize", "RiskLevel", "TargetIrr", "Tenure", "Title", "TotalTargetCorpus", "UpdatedAt" },
                values: new object[] { 1, "Commercial AIF", null, null, 50000000m, 1, new DateTime(2026, 1, 10, 0, 0, 0, 0, DateTimeKind.Utc), 5, "Grade-A office park pre-leased to Fortune 500 GCCs with 8.5% entry cap rate", null, true, 10000000m, "Moderate", 16.5m, "5 Years", "Prime Bengaluru Commercial Yield Fund II", 1000000000m, null });

            migrationBuilder.InsertData(
                table: "Investors",
                columns: new[] { "Id", "AssignedIrmId", "AssignedIrmName", "CommittedAum", "CompanyId", "CreatedAt", "Email", "HandoverId", "InvestmentCapacity", "InvestmentMandate", "Name", "Notes", "OriginalOwnerId", "Phone", "PreferredAssetClass", "ReferralSource", "RiskTolerance", "Status", "UpdatedAt" },
                values: new object[,]
                {
                    { 1, 5, "Dhinakaran", "₹5.0 Cr", 1, new DateTime(2026, 1, 15, 0, 0, 0, 0, DateTimeKind.Utc), "rajesh.singhania@apexcapital.in", null, "₹5 Cr – ₹10 Cr", "Growth focused Category II AIF with commercial allocation", "Rajesh Singhania", "Senior HNI investor with portfolio in Bangalore", null, "+91 98200 44556", "AIF", "Wealth Partner Direct", "Moderate", 1, null },
                    { 2, 5, "Dhinakaran", null, 1, new DateTime(2026, 2, 1, 0, 0, 0, 0, DateTimeKind.Utc), "meera.nambiar@nambiarholdings.com", null, "₹10 Cr – ₹25 Cr", "High-yield commercial development tranches", "Meera Nambiar", "Family office lead referred via CFO network", null, "+91 98450 99881", "Commercial AIF", null, "Aggressive", 0, null }
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
                columns: new[] { "Id", "ActivityLogsJson", "AssignedIrmId", "AssignedIrmName", "CompanyId", "CreatedAt", "HandoverId", "InvestmentAmount", "InvestorEmail", "InvestorId", "InvestorName", "InvestorPhone", "LastActionSnippet", "LastActivityDate", "OriginalOwnerId", "PreferredAssetClass", "Priority", "StageEnteredAt", "StageId", "UpdatedAt", "Value" },
                values: new object[,]
                {
                    { 1, null, 5, "Dhinakaran", 1, new DateTime(2026, 1, 15, 0, 0, 0, 0, DateTimeKind.Utc), null, "₹5 Cr", "rajesh.singhania@apexcapital.in", 1, "Rajesh Singhania", "+91 98200 44556", null, null, null, "AIF", "High", new DateTime(2026, 2, 10, 0, 0, 0, 0, DateTimeKind.Utc), "qualified_investor", null, 50000000m },
                    { 2, null, 5, "Dhinakaran", 1, new DateTime(2026, 2, 1, 0, 0, 0, 0, DateTimeKind.Utc), null, "₹10 Cr", "meera.nambiar@nambiarholdings.com", 2, "Meera Nambiar", "+91 98450 99881", null, null, null, "Commercial AIF", "High", new DateTime(2026, 2, 1, 0, 0, 0, 0, DateTimeKind.Utc), "leads", null, 100000000m }
                });

            migrationBuilder.CreateIndex(
                name: "IX_GhlInvestors_AssignedAgentId",
                table: "GhlInvestors",
                column: "AssignedAgentId");

            migrationBuilder.CreateIndex(
                name: "IX_GhlInvestors_CompanyId",
                table: "GhlInvestors",
                column: "CompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_GhlInvestors_HandoverId",
                table: "GhlInvestors",
                column: "HandoverId");

            migrationBuilder.CreateIndex(
                name: "IX_GhlInvestors_OriginalOwnerId",
                table: "GhlInvestors",
                column: "OriginalOwnerId");

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
                name: "IX_IrmPipelineCards_HandoverId",
                table: "IrmPipelineCards",
                column: "HandoverId");

            migrationBuilder.CreateIndex(
                name: "IX_IrmPipelineCards_InvestorId",
                table: "IrmPipelineCards",
                column: "InvestorId");

            migrationBuilder.CreateIndex(
                name: "IX_IrmPipelineCards_OriginalOwnerId",
                table: "IrmPipelineCards",
                column: "OriginalOwnerId");

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
                name: "FK_AuditLogs_tenants_CompanyId",
                table: "AuditLogs",
                column: "CompanyId",
                principalTable: "tenants",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_consultations_Investors_InvestorId",
                table: "consultations",
                column: "InvestorId",
                principalTable: "Investors",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
