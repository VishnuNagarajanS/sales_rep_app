using backend.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20261009110000_BackfillCallRecordPrimaryKeys")]
public sealed class BackfillCallRecordPrimaryKeys : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            -- 1. Link CallRecords to Leads where LeadId is NULL but phone digits match
            WITH lead_matches AS (
                SELECT c."Id" AS call_id, l."Id" AS matched_lead_id, l."CompanyId" AS lead_company_id
                FROM call_records c
                JOIN leads l ON RIGHT(regexp_replace(c."ContactPhone", '\D', '', 'g'), 10) = RIGHT(regexp_replace(l."Phone", '\D', '', 'g'), 10)
                WHERE c."LeadId" IS NULL
                  AND length(regexp_replace(c."ContactPhone", '\D', '', 'g')) >= 7
            )
            UPDATE call_records
            SET "LeadId" = m.matched_lead_id
            FROM lead_matches m
            WHERE call_records."Id" = m.call_id
              AND call_records."LeadId" IS NULL;

            -- 2. Link CallRecords to Customers where CustomerId is NULL but phone digits match
            WITH cust_matches AS (
                SELECT c."Id" AS call_id, cust."Id" AS matched_cust_id, cust."CompanyId" AS cust_company_id
                FROM call_records c
                JOIN customers cust ON RIGHT(regexp_replace(c."ContactPhone", '\D', '', 'g'), 10) = RIGHT(regexp_replace(cust."Phone", '\D', '', 'g'), 10)
                WHERE c."CustomerId" IS NULL
                  AND length(regexp_replace(c."ContactPhone", '\D', '', 'g')) >= 7
            )
            UPDATE call_records
            SET "CustomerId" = m.matched_cust_id
            FROM cust_matches m
            WHERE call_records."Id" = m.call_id
              AND call_records."CustomerId" IS NULL;

            -- 3. For any call with a LeadId belonging to a converted lead, ensure CustomerId is linked
            WITH converted_lead_calls AS (
                SELECT l."Id" AS lead_id, MIN(c."Id") AS customer_id
                FROM leads l
                JOIN customers c ON RIGHT(regexp_replace(l."Phone", '\D', '', 'g'), 10) = RIGHT(regexp_replace(c."Phone", '\D', '', 'g'), 10)
                WHERE lower(l."Status") = 'converted'
                GROUP BY l."Id"
            )
            UPDATE call_records
            SET "CustomerId" = cl.customer_id
            FROM converted_lead_calls cl
            WHERE call_records."LeadId" = cl.lead_id
              AND call_records."CustomerId" IS NULL;

            -- 4. For any call with a CustomerId belonging to a customer converted from a lead, ensure LeadId is linked
            WITH cust_lead_links AS (
                SELECT c."Id" AS customer_id, MIN(l."Id") AS lead_id
                FROM customers c
                JOIN leads l ON RIGHT(regexp_replace(c."Phone", '\D', '', 'g'), 10) = RIGHT(regexp_replace(l."Phone", '\D', '', 'g'), 10)
                GROUP BY c."Id"
            )
            UPDATE call_records
            SET "LeadId" = cl.lead_id
            FROM cust_lead_links cl
            WHERE call_records."CustomerId" = cl.customer_id
              AND call_records."LeadId" IS NULL;
        """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}
