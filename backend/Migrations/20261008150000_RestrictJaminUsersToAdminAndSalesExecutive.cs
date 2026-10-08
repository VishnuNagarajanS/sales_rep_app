using backend.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20261008150000_RestrictJaminUsersToAdminAndSalesExecutive")]
public sealed class RestrictJaminUsersToAdminAndSalesExecutive : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            UPDATE users AS u
            SET "RoleId" = sales_exec."Id"
            FROM roles AS sales_exec
            WHERE u."CompanyId" = 2
              AND sales_exec."Code" = 'sales_executive'
              AND u."RoleId" IN (
                  SELECT r."Id" FROM roles AS r
                  WHERE r."Code" IN ('sales_manager', 'irm')
              );
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Role normalization is intentionally irreversible: restoring a manager/IRM role
        // would violate the Jamin tenant's supported role set.
    }
}
