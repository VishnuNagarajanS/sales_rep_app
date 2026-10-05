using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations;

[DbContext(typeof(backend.Data.ApplicationDbContext))]
[Migration("20261001160000_AddHeldByCustomerIdToPlotAndLeadIdToBooking")]
public partial class AddHeldByCustomerIdToPlotAndLeadIdToBooking : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(@"
            DO $$
            BEGIN
                -- 1. Add HeldByCustomerId to jamin_plots
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                      AND table_name = 'jamin_plots' 
                      AND column_name = 'HeldByCustomerId'
                ) THEN
                    ALTER TABLE jamin_plots ADD COLUMN ""HeldByCustomerId"" integer;
                    ALTER TABLE jamin_plots ADD CONSTRAINT ""FK_jamin_plots_customers_HeldByCustomerId"" 
                        FOREIGN KEY (""HeldByCustomerId"") REFERENCES customers (""Id"") ON DELETE SET NULL;
                    CREATE INDEX IF NOT EXISTS ""IX_jamin_plots_HeldByCustomerId"" ON jamin_plots (""HeldByCustomerId"");
                END IF;

                -- 2. Add LeadId to jamin_bookings
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                      AND table_name = 'jamin_bookings' 
                      AND column_name = 'LeadId'
                ) THEN
                    ALTER TABLE jamin_bookings ADD COLUMN ""LeadId"" integer;
                    ALTER TABLE jamin_bookings ADD CONSTRAINT ""FK_jamin_bookings_leads_LeadId"" 
                        FOREIGN KEY (""LeadId"") REFERENCES leads (""Id"") ON DELETE SET NULL;
                    CREATE INDEX IF NOT EXISTS ""IX_jamin_bookings_LeadId"" ON jamin_bookings (""LeadId"");
                END IF;
            END $$;
        ");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(@"
            DO $$
            BEGIN
                -- Revert jamin_plots HeldByCustomerId
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                      AND table_name = 'jamin_plots' 
                      AND column_name = 'HeldByCustomerId'
                ) THEN
                    ALTER TABLE jamin_plots DROP CONSTRAINT IF EXISTS ""FK_jamin_plots_customers_HeldByCustomerId"";
                    DROP INDEX IF EXISTS ""IX_jamin_plots_HeldByCustomerId"";
                    ALTER TABLE jamin_plots DROP COLUMN ""HeldByCustomerId"";
                END IF;

                -- Revert jamin_bookings LeadId
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                      AND table_name = 'jamin_bookings' 
                      AND column_name = 'LeadId'
                ) THEN
                    ALTER TABLE jamin_bookings DROP CONSTRAINT IF EXISTS ""FK_jamin_bookings_leads_LeadId"";
                    DROP INDEX IF EXISTS ""IX_jamin_bookings_LeadId"";
                    ALTER TABLE jamin_bookings DROP COLUMN ""LeadId"";
                END IF;
            END $$;
        ");
    }
}
