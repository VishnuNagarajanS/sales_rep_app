using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations;

[DbContext(typeof(backend.Data.ApplicationDbContext))]
[Migration("20261001140000_AddCustomerIdAndPaymentTermsToJaminBooking")]
public partial class AddCustomerIdAndPaymentTermsToJaminBooking : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(@"
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                      AND table_name = 'jamin_bookings' 
                      AND column_name = 'CustomerId'
                ) THEN
                    ALTER TABLE jamin_bookings ADD COLUMN ""CustomerId"" integer;
                    ALTER TABLE jamin_bookings ADD CONSTRAINT ""FK_jamin_bookings_customers_CustomerId"" 
                        FOREIGN KEY (""CustomerId"") REFERENCES customers (""Id"") ON DELETE SET NULL;
                    CREATE INDEX IF NOT EXISTS ""IX_jamin_bookings_CustomerId"" ON jamin_bookings (""CustomerId"");
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                      AND table_name = 'jamin_bookings' 
                      AND column_name = 'PaymentTerms'
                ) THEN
                    ALTER TABLE jamin_bookings ADD COLUMN ""PaymentTerms"" character varying(500);
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
                      AND table_name = 'jamin_bookings' 
                      AND column_name = 'CustomerId'
                ) THEN
                    ALTER TABLE jamin_bookings DROP CONSTRAINT IF EXISTS ""FK_jamin_bookings_customers_CustomerId"";
                    DROP INDEX IF EXISTS ""IX_jamin_bookings_CustomerId"";
                    ALTER TABLE jamin_bookings DROP COLUMN ""CustomerId"";
                END IF;

                IF EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                      AND table_name = 'jamin_bookings' 
                      AND column_name = 'PaymentTerms'
                ) THEN
                    ALTER TABLE jamin_bookings DROP COLUMN ""PaymentTerms"";
                END IF;
            END $$;
        ");
    }
}
