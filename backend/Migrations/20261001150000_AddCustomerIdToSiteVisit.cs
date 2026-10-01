using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations;

[DbContext(typeof(backend.Data.ApplicationDbContext))]
[Migration("20261001150000_AddCustomerIdToSiteVisit")]
public partial class AddCustomerIdToSiteVisit : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(@"
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                      AND table_name = 'site_visits' 
                      AND column_name = 'CustomerId'
                ) THEN
                    ALTER TABLE site_visits ADD COLUMN ""CustomerId"" integer;
                    ALTER TABLE site_visits ADD CONSTRAINT ""FK_site_visits_customers_CustomerId"" 
                        FOREIGN KEY (""CustomerId"") REFERENCES customers (""Id"") ON DELETE SET NULL;
                    CREATE INDEX IF NOT EXISTS ""IX_site_visits_CustomerId"" ON site_visits (""CustomerId"");
                END IF;
            END $$;
        ");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(@"
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                      AND table_name = 'site_visits' 
                      AND column_name = 'CustomerId'
                ) THEN
                    ALTER TABLE site_visits DROP CONSTRAINT IF EXISTS ""FK_site_visits_customers_CustomerId"";
                    DROP INDEX IF EXISTS ""IX_site_visits_CustomerId"";
                    ALTER TABLE site_visits DROP COLUMN ""CustomerId"";
                END IF;
            END $$;
        ");
    }
}
