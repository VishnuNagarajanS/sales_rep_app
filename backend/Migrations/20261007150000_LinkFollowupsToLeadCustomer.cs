using backend.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20261007150000_LinkFollowupsToLeadCustomer")]
public partial class LinkFollowupsToLeadCustomer : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<int>(
            name: "LeadId",
            table: "followups",
            type: "integer",
            nullable: true);

        migrationBuilder.AddColumn<int>(
            name: "CustomerId",
            table: "followups",
            type: "integer",
            nullable: true);

        migrationBuilder.Sql("""
            UPDATE followups AS f
            SET "LeadId" = l."Id"
            FROM leads AS l
            WHERE lower(f."ContactType") = 'lead'
              AND f."ContactId" ~ '^[0-9]+$'
              AND l."Id"::text = f."ContactId"
              AND l."CompanyId" = f."CompanyId";
            """);

        migrationBuilder.Sql("""
            UPDATE followups AS f
            SET "CustomerId" = c."Id"
            FROM customers AS c
            WHERE lower(f."ContactType") = 'customer'
              AND f."ContactId" ~ '^[0-9]+$'
              AND c."Id"::text = f."ContactId"
              AND c."CompanyId" = f."CompanyId";
            """);

        migrationBuilder.CreateIndex(
            name: "IX_followups_LeadId",
            table: "followups",
            column: "LeadId");

        migrationBuilder.CreateIndex(
            name: "IX_followups_CustomerId",
            table: "followups",
            column: "CustomerId");

        migrationBuilder.AddForeignKey(
            name: "FK_followups_leads_LeadId",
            table: "followups",
            column: "LeadId",
            principalTable: "leads",
            principalColumn: "Id",
            onDelete: ReferentialAction.SetNull);

        migrationBuilder.AddForeignKey(
            name: "FK_followups_customers_CustomerId",
            table: "followups",
            column: "CustomerId",
            principalTable: "customers",
            principalColumn: "Id",
            onDelete: ReferentialAction.SetNull);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropForeignKey(name: "FK_followups_leads_LeadId", table: "followups");
        migrationBuilder.DropForeignKey(name: "FK_followups_customers_CustomerId", table: "followups");
        migrationBuilder.DropIndex(name: "IX_followups_LeadId", table: "followups");
        migrationBuilder.DropIndex(name: "IX_followups_CustomerId", table: "followups");
        migrationBuilder.DropColumn(name: "LeadId", table: "followups");
        migrationBuilder.DropColumn(name: "CustomerId", table: "followups");
    }
}
