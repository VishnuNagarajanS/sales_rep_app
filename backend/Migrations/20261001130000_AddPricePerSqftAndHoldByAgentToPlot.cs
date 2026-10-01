using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations;

[DbContext(typeof(backend.Data.ApplicationDbContext))]
[Migration("20261001130000_AddPricePerSqftAndHoldByAgentToPlot")]
public partial class AddPricePerSqftAndHoldByAgentToPlot : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(@"
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                      AND table_name = 'jamin_plots' 
                      AND column_name = 'PricePerSqft'
                ) THEN
                    ALTER TABLE jamin_plots ADD COLUMN ""PricePerSqft"" numeric(18,2) NOT NULL DEFAULT 0;
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                      AND table_name = 'jamin_plots' 
                      AND column_name = 'HoldByAgent'
                ) THEN
                    ALTER TABLE jamin_plots ADD COLUMN ""HoldByAgent"" character varying(150);
                END IF;

                -- Populate PricePerSqft for existing rows
                UPDATE jamin_plots 
                SET ""PricePerSqft"" = ROUND(""Price"" / ""AreaSqFt"", 2) 
                WHERE ""AreaSqFt"" > 0 AND (""PricePerSqft"" = 0 OR ""PricePerSqft"" IS NULL);
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
                      AND table_name = 'jamin_plots' 
                      AND column_name = 'PricePerSqft'
                ) THEN
                    ALTER TABLE jamin_plots DROP COLUMN ""PricePerSqft"";
                END IF;

                IF EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                      AND table_name = 'jamin_plots' 
                      AND column_name = 'HoldByAgent'
                ) THEN
                    ALTER TABLE jamin_plots DROP COLUMN ""HoldByAgent"";
                END IF;
            END $$;
        ");
    }
}
