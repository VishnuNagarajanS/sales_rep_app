using backend.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20261008130000_BackfillConvertedLeadActivityLinks")]
public sealed class BackfillConvertedLeadActivityLinks : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            WITH converted_leads AS (
                SELECT l."Id" AS "LeadId", l."CompanyId", MIN(c."Id") AS "CustomerId"
                FROM leads AS l
                JOIN customers AS c
                  ON c."CompanyId" = l."CompanyId"
                 AND c."Phone" = l."Phone"
                WHERE lower(l."Status") = 'converted'
                GROUP BY l."Id", l."CompanyId"
                HAVING COUNT(c."Id") = 1
            )
            UPDATE followups AS f
            SET "CustomerId" = x."CustomerId",
                "ContactType" = 'customer',
                "ContactId" = x."CustomerId"::text
            FROM converted_leads AS x
            WHERE f."LeadId" = x."LeadId"
              AND f."CompanyId" = x."CompanyId";

            WITH converted_leads AS (
                SELECT l."Id" AS "LeadId", l."CompanyId", MIN(c."Id") AS "CustomerId"
                FROM leads AS l
                JOIN customers AS c
                  ON c."CompanyId" = l."CompanyId"
                 AND c."Phone" = l."Phone"
                WHERE lower(l."Status") = 'converted'
                GROUP BY l."Id", l."CompanyId"
                HAVING COUNT(c."Id") = 1
            )
            UPDATE call_records AS a
            SET "CustomerId" = x."CustomerId"
            FROM converted_leads AS x
            WHERE a."LeadId" = x."LeadId"
              AND a."CompanyId" = x."CompanyId";

            WITH converted_leads AS (
                SELECT l."Id" AS "LeadId", l."CompanyId", MIN(c."Id") AS "CustomerId"
                FROM leads AS l
                JOIN customers AS c
                  ON c."CompanyId" = l."CompanyId"
                 AND c."Phone" = l."Phone"
                WHERE lower(l."Status") = 'converted'
                GROUP BY l."Id", l."CompanyId"
                HAVING COUNT(c."Id") = 1
            )
            UPDATE site_visits AS v
            SET "CustomerId" = x."CustomerId",
                "ContactType" = 'customer'
            FROM converted_leads AS x
            WHERE v."LeadId" = x."LeadId"
              AND v."TenantId" = x."CompanyId";

            WITH converted_leads AS (
                SELECT l."Id" AS "LeadId", l."CompanyId", MIN(c."Id") AS "CustomerId"
                FROM leads AS l
                JOIN customers AS c
                  ON c."CompanyId" = l."CompanyId"
                 AND c."Phone" = l."Phone"
                WHERE lower(l."Status") = 'converted'
                GROUP BY l."Id", l."CompanyId"
                HAVING COUNT(c."Id") = 1
            )
            UPDATE jamin_bookings AS b
            SET "CustomerId" = x."CustomerId"
            FROM converted_leads AS x
            WHERE b."LeadId" = x."LeadId"
              AND b."CompanyId" = x."CompanyId"
              AND b."CustomerId" IS NULL;

            WITH converted_leads AS (
                SELECT l."Id" AS "LeadId", l."CompanyId", MIN(c."Id") AS "CustomerId"
                FROM leads AS l
                JOIN customers AS c
                  ON c."CompanyId" = l."CompanyId"
                 AND c."Phone" = l."Phone"
                WHERE lower(l."Status") = 'converted'
                GROUP BY l."Id", l."CompanyId"
                HAVING COUNT(c."Id") = 1
            )
            UPDATE "Notifications" AS n
            SET "CustomerId" = x."CustomerId"
            FROM converted_leads AS x
            WHERE n."LeadId" = x."LeadId"
              AND n."CompanyId" = x."CompanyId";

            WITH converted_leads AS (
                SELECT l."Id" AS "LeadId", l."CompanyId", MIN(c."Id") AS "CustomerId"
                FROM leads AS l
                JOIN customers AS c
                  ON c."CompanyId" = l."CompanyId"
                 AND c."Phone" = l."Phone"
                WHERE lower(l."Status") = 'converted'
                GROUP BY l."Id", l."CompanyId"
                HAVING COUNT(c."Id") = 1
            )
            UPDATE "AuditLogs" AS a
            SET "CustomerId" = x."CustomerId"
            FROM converted_leads AS x
            WHERE a."LeadId" = x."LeadId"
              AND (a."CompanyId" IS NULL OR a."CompanyId" = x."CompanyId");
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // This migration only backfills relationships. Removing those links on rollback
        // would also erase valid customer links created after the migration ran.
    }
}
