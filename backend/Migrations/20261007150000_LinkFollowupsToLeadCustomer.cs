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
        migrationBuilder.Sql(@"
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'followups' AND column_name = 'LeadId') THEN
                    ALTER TABLE followups ADD COLUMN ""LeadId"" integer;
                END IF;

                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'followups' AND column_name = 'CustomerId') THEN
                    ALTER TABLE followups ADD COLUMN ""CustomerId"" integer;
                END IF;

                UPDATE followups AS f
                SET ""LeadId"" = l.""Id""
                FROM leads AS l
                WHERE lower(f.""ContactType"") = 'lead'
                  AND f.""ContactId"" ~ '^[0-9]+$'
                  AND l.""Id""::text = f.""ContactId""
                  AND l.""CompanyId"" = f.""CompanyId""
                  AND f.""LeadId"" IS NULL;

                UPDATE followups AS f
                SET ""CustomerId"" = c.""Id""
                FROM customers AS c
                WHERE lower(f.""ContactType"") = 'customer'
                  AND f.""ContactId"" ~ '^[0-9]+$'
                  AND c.""Id""::text = f.""ContactId""
                  AND c.""CompanyId"" = f.""CompanyId""
                  AND f.""CustomerId"" IS NULL;

                CREATE INDEX IF NOT EXISTS ""IX_followups_LeadId"" ON followups (""LeadId"");
                CREATE INDEX IF NOT EXISTS ""IX_followups_CustomerId"" ON followups (""CustomerId"");

                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_followups_leads_LeadId') THEN
                    ALTER TABLE followups ADD CONSTRAINT ""FK_followups_leads_LeadId"" FOREIGN KEY (""LeadId"") REFERENCES leads (""Id"") ON DELETE SET NULL;
                END IF;

                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_followups_customers_CustomerId') THEN
                    ALTER TABLE followups ADD CONSTRAINT ""FK_followups_customers_CustomerId"" FOREIGN KEY (""CustomerId"") REFERENCES customers (""Id"") ON DELETE SET NULL;
                END IF;
            END $$;
        ");
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
