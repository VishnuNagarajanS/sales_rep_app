using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations;

[DbContext(typeof(backend.Data.ApplicationDbContext))]
[Migration("20261007120000_MakeCustomerAgentOptional")]
public sealed class MakeCustomerAgentOptional : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("ALTER TABLE customers ALTER COLUMN \"AssignedAgentId\" DROP NOT NULL;");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM customers WHERE "AssignedAgentId" IS NULL) THEN
                    RAISE EXCEPTION 'Cannot roll back MakeCustomerAgentOptional while customers have no assigned agent.';
                END IF;

                ALTER TABLE customers ALTER COLUMN "AssignedAgentId" SET NOT NULL;
            END $$;
            """);
    }
}
