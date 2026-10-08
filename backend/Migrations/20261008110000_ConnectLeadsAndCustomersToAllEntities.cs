using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations;

[DbContext(typeof(backend.Data.ApplicationDbContext))]
[Migration("20261008110000_ConnectLeadsAndCustomersToAllEntities")]
public partial class ConnectLeadsAndCustomersToAllEntities : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(@"
            DO $$
            BEGIN
                -- 1. Notifications
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Notifications') THEN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Notifications' AND column_name = 'LeadId') THEN
                        ALTER TABLE ""Notifications"" ADD COLUMN ""LeadId"" integer;
                        ALTER TABLE ""Notifications"" ADD CONSTRAINT ""FK_Notifications_leads_LeadId"" FOREIGN KEY (""LeadId"") REFERENCES leads (""Id"") ON DELETE SET NULL;
                        CREATE INDEX IF NOT EXISTS ""IX_Notifications_LeadId"" ON ""Notifications"" (""LeadId"");
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Notifications' AND column_name = 'CustomerId') THEN
                        ALTER TABLE ""Notifications"" ADD COLUMN ""CustomerId"" integer;
                        ALTER TABLE ""Notifications"" ADD CONSTRAINT ""FK_Notifications_customers_CustomerId"" FOREIGN KEY (""CustomerId"") REFERENCES customers (""Id"") ON DELETE SET NULL;
                        CREATE INDEX IF NOT EXISTS ""IX_Notifications_CustomerId"" ON ""Notifications"" (""CustomerId"");
                    END IF;
                END IF;

                -- 2. AuditLogs
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'AuditLogs') THEN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'AuditLogs' AND column_name = 'LeadId') THEN
                        ALTER TABLE ""AuditLogs"" ADD COLUMN ""LeadId"" integer;
                        ALTER TABLE ""AuditLogs"" ADD CONSTRAINT ""FK_AuditLogs_leads_LeadId"" FOREIGN KEY (""LeadId"") REFERENCES leads (""Id"") ON DELETE SET NULL;
                        CREATE INDEX IF NOT EXISTS ""IX_AuditLogs_LeadId"" ON ""AuditLogs"" (""LeadId"");
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'AuditLogs' AND column_name = 'CustomerId') THEN
                        ALTER TABLE ""AuditLogs"" ADD COLUMN ""CustomerId"" integer;
                        ALTER TABLE ""AuditLogs"" ADD CONSTRAINT ""FK_AuditLogs_customers_CustomerId"" FOREIGN KEY (""CustomerId"") REFERENCES customers (""Id"") ON DELETE SET NULL;
                        CREATE INDEX IF NOT EXISTS ""IX_AuditLogs_CustomerId"" ON ""AuditLogs"" (""CustomerId"");
                    END IF;

                    UPDATE ""AuditLogs"" AS a
                    SET ""LeadId"" = l.""Id""
                    FROM leads AS l
                    WHERE lower(trim(a.""EntityType"")) = 'lead'
                      AND a.""EntityId"" = l.""Id""::text
                      AND (a.""CompanyId"" IS NULL OR a.""CompanyId"" = l.""CompanyId"");

                    UPDATE ""AuditLogs"" AS a
                    SET ""CustomerId"" = c.""Id""
                    FROM customers AS c
                    WHERE lower(trim(a.""EntityType"")) = 'customer'
                      AND a.""EntityId"" = c.""Id""::text
                      AND (a.""CompanyId"" IS NULL OR a.""CompanyId"" = c.""CompanyId"");
                END IF;

                -- 3. call_records
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'call_records') THEN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'call_records' AND column_name = 'LeadId') THEN
                        ALTER TABLE ""call_records"" ADD COLUMN ""LeadId"" integer;
                        ALTER TABLE ""call_records"" ADD CONSTRAINT ""FK_call_records_leads_LeadId"" FOREIGN KEY (""LeadId"") REFERENCES leads (""Id"") ON DELETE SET NULL;
                        CREATE INDEX IF NOT EXISTS ""IX_call_records_LeadId"" ON ""call_records"" (""LeadId"");
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'call_records' AND column_name = 'CustomerId') THEN
                        ALTER TABLE ""call_records"" ADD COLUMN ""CustomerId"" integer;
                        ALTER TABLE ""call_records"" ADD CONSTRAINT ""FK_call_records_customers_CustomerId"" FOREIGN KEY (""CustomerId"") REFERENCES customers (""Id"") ON DELETE SET NULL;
                        CREATE INDEX IF NOT EXISTS ""IX_call_records_CustomerId"" ON ""call_records"" (""CustomerId"");
                    END IF;
                END IF;

                -- 4. followups
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'followups') THEN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'followups' AND column_name = 'LeadId') THEN
                        ALTER TABLE ""followups"" ADD COLUMN ""LeadId"" integer;
                        ALTER TABLE ""followups"" ADD CONSTRAINT ""FK_followups_leads_LeadId"" FOREIGN KEY (""LeadId"") REFERENCES leads (""Id"") ON DELETE SET NULL;
                        CREATE INDEX IF NOT EXISTS ""IX_followups_LeadId"" ON ""followups"" (""LeadId"");
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'followups' AND column_name = 'CustomerId') THEN
                        ALTER TABLE ""followups"" ADD COLUMN ""CustomerId"" integer;
                        ALTER TABLE ""followups"" ADD CONSTRAINT ""FK_followups_customers_CustomerId"" FOREIGN KEY (""CustomerId"") REFERENCES customers (""Id"") ON DELETE SET NULL;
                        CREATE INDEX IF NOT EXISTS ""IX_followups_CustomerId"" ON ""followups"" (""CustomerId"");
                    END IF;
                END IF;

                -- 5. site_visits
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'site_visits') THEN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_visits' AND column_name = 'LeadId') THEN
                        ALTER TABLE ""site_visits"" ADD COLUMN ""LeadId"" integer;
                        ALTER TABLE ""site_visits"" ADD CONSTRAINT ""FK_site_visits_leads_LeadId"" FOREIGN KEY (""LeadId"") REFERENCES leads (""Id"") ON DELETE SET NULL;
                        CREATE INDEX IF NOT EXISTS ""IX_site_visits_LeadId"" ON ""site_visits"" (""LeadId"");
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_visits' AND column_name = 'CustomerId') THEN
                        ALTER TABLE ""site_visits"" ADD COLUMN ""CustomerId"" integer;
                        ALTER TABLE ""site_visits"" ADD CONSTRAINT ""FK_site_visits_customers_CustomerId"" FOREIGN KEY (""CustomerId"") REFERENCES customers (""Id"") ON DELETE SET NULL;
                        CREATE INDEX IF NOT EXISTS ""IX_site_visits_CustomerId"" ON ""site_visits"" (""CustomerId"");
                    END IF;
                END IF;

                -- 6. jamin_bookings
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'jamin_bookings') THEN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jamin_bookings' AND column_name = 'LeadId') THEN
                        ALTER TABLE ""jamin_bookings"" ADD COLUMN ""LeadId"" integer;
                        ALTER TABLE ""jamin_bookings"" ADD CONSTRAINT ""FK_jamin_bookings_leads_LeadId"" FOREIGN KEY (""LeadId"") REFERENCES leads (""Id"") ON DELETE SET NULL;
                        CREATE INDEX IF NOT EXISTS ""IX_jamin_bookings_LeadId"" ON ""jamin_bookings"" (""LeadId"");
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jamin_bookings' AND column_name = 'CustomerId') THEN
                        ALTER TABLE ""jamin_bookings"" ADD COLUMN ""CustomerId"" integer;
                        ALTER TABLE ""jamin_bookings"" ADD CONSTRAINT ""FK_jamin_bookings_customers_CustomerId"" FOREIGN KEY (""CustomerId"") REFERENCES customers (""Id"") ON DELETE SET NULL;
                        CREATE INDEX IF NOT EXISTS ""IX_jamin_bookings_CustomerId"" ON ""jamin_bookings"" (""CustomerId"");
                    END IF;
                END IF;
            END $$;
        ");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(@"
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Notifications' AND column_name = 'LeadId') THEN
                    ALTER TABLE ""Notifications"" DROP CONSTRAINT IF EXISTS ""FK_Notifications_leads_LeadId"";
                    DROP INDEX IF EXISTS ""IX_Notifications_LeadId"";
                    ALTER TABLE ""Notifications"" DROP COLUMN ""LeadId"";
                END IF;
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Notifications' AND column_name = 'CustomerId') THEN
                    ALTER TABLE ""Notifications"" DROP CONSTRAINT IF EXISTS ""FK_Notifications_customers_CustomerId"";
                    DROP INDEX IF EXISTS ""IX_Notifications_CustomerId"";
                    ALTER TABLE ""Notifications"" DROP COLUMN ""CustomerId"";
                END IF;

                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'AuditLogs' AND column_name = 'LeadId') THEN
                    ALTER TABLE ""AuditLogs"" DROP CONSTRAINT IF EXISTS ""FK_AuditLogs_leads_LeadId"";
                    DROP INDEX IF EXISTS ""IX_AuditLogs_LeadId"";
                    ALTER TABLE ""AuditLogs"" DROP COLUMN ""LeadId"";
                END IF;
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'AuditLogs' AND column_name = 'CustomerId') THEN
                    ALTER TABLE ""AuditLogs"" DROP CONSTRAINT IF EXISTS ""FK_AuditLogs_customers_CustomerId"";
                    DROP INDEX IF EXISTS ""IX_AuditLogs_CustomerId"";
                    ALTER TABLE ""AuditLogs"" DROP COLUMN ""CustomerId"";
                END IF;
            END $$;
        ");
    }
}
