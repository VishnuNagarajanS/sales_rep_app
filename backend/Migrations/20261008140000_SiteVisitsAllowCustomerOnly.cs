using backend.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20261008140000_SiteVisitsAllowCustomerOnly")]
public sealed class SiteVisitsAllowCustomerOnly : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE site_visits DROP CONSTRAINT IF EXISTS "FK_site_visits_leads_LeadId";
            ALTER TABLE site_visits ALTER COLUMN "LeadId" DROP NOT NULL;
            ALTER TABLE site_visits
                ADD CONSTRAINT "FK_site_visits_leads_LeadId"
                FOREIGN KEY ("LeadId") REFERENCES leads ("Id") ON DELETE SET NULL;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM site_visits WHERE "LeadId" IS NULL) THEN
                    RAISE EXCEPTION 'Cannot roll back SiteVisitsAllowCustomerOnly while site visits have no lead.';
                END IF;

                ALTER TABLE site_visits DROP CONSTRAINT IF EXISTS "FK_site_visits_leads_LeadId";
                ALTER TABLE site_visits ALTER COLUMN "LeadId" SET NOT NULL;
                ALTER TABLE site_visits
                    ADD CONSTRAINT "FK_site_visits_leads_LeadId"
                    FOREIGN KEY ("LeadId") REFERENCES leads ("Id") ON DELETE CASCADE;
            END $$;
            """);
    }
}
