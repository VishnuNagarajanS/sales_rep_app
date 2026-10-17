using backend.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20261015183500_AddMissingSiteVisitsColumns")]
public sealed class AddMissingSiteVisitsColumns : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'site_visits') THEN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_schema = 'public' AND table_name = 'site_visits' AND column_name = 'TenantId'
                    ) THEN
                        ALTER TABLE site_visits ADD COLUMN "TenantId" integer NULL DEFAULT 1;
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_visits' AND column_name = 'CompanyId') THEN
                            UPDATE site_visits SET "TenantId" = "CompanyId" WHERE "TenantId" IS NULL;
                        END IF;
                    END IF;

                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_schema = 'public' AND table_name = 'site_visits' AND column_name = 'PlotId'
                    ) THEN
                        ALTER TABLE site_visits ADD COLUMN "PlotId" integer;
                        CREATE INDEX IF NOT EXISTS "IX_site_visits_PlotId" ON site_visits ("PlotId");
                    END IF;

                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_schema = 'public' AND table_name = 'site_visits' AND column_name = 'ProjectId'
                    ) THEN
                        ALTER TABLE site_visits ADD COLUMN "ProjectId" integer;
                        CREATE INDEX IF NOT EXISTS "IX_site_visits_ProjectId" ON site_visits ("ProjectId");
                    END IF;

                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_schema = 'public' AND table_name = 'site_visits' AND column_name = 'CustomerId'
                    ) THEN
                        ALTER TABLE site_visits ADD COLUMN "CustomerId" integer;
                        CREATE INDEX IF NOT EXISTS "IX_site_visits_CustomerId" ON site_visits ("CustomerId");
                    END IF;

                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_schema = 'public' AND table_name = 'site_visits' AND column_name = 'VisitorNote'
                    ) THEN
                        ALTER TABLE site_visits ADD COLUMN "VisitorNote" character varying(2000);
                    END IF;
                END IF;
            END $$;
        """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}
