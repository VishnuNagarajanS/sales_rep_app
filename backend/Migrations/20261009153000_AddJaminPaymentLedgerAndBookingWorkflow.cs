using backend.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20261009153000_AddJaminPaymentLedgerAndBookingWorkflow")]
public sealed class AddJaminPaymentLedgerAndBookingWorkflow : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DO $$
            BEGIN
                -- 1. Independently guard each new column on jamin_bookings
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = 'public' AND table_name = 'jamin_bookings' AND column_name = 'PaymentStatus'
                ) THEN
                    ALTER TABLE jamin_bookings ADD COLUMN "PaymentStatus" character varying(50) NOT NULL DEFAULT 'Pending';
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = 'public' AND table_name = 'jamin_bookings' AND column_name = 'HoldExpiresAt'
                ) THEN
                    ALTER TABLE jamin_bookings ADD COLUMN "HoldExpiresAt" timestamp with time zone;
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = 'public' AND table_name = 'jamin_bookings' AND column_name = 'BasePrice'
                ) THEN
                    ALTER TABLE jamin_bookings ADD COLUMN "BasePrice" numeric(18,2) NOT NULL DEFAULT 0;
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = 'public' AND table_name = 'jamin_bookings' AND column_name = 'DevelopmentCharges'
                ) THEN
                    ALTER TABLE jamin_bookings ADD COLUMN "DevelopmentCharges" numeric(18,2) NOT NULL DEFAULT 0;
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = 'public' AND table_name = 'jamin_bookings' AND column_name = 'ApprovedDiscounts'
                ) THEN
                    ALTER TABLE jamin_bookings ADD COLUMN "ApprovedDiscounts" numeric(18,2) NOT NULL DEFAULT 0;
                END IF;

                -- Independently guard each cancellation audit column
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = 'public' AND table_name = 'jamin_bookings' AND column_name = 'CancelledAt'
                ) THEN
                    ALTER TABLE jamin_bookings ADD COLUMN "CancelledAt" timestamp with time zone;
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = 'public' AND table_name = 'jamin_bookings' AND column_name = 'CancelledByUserId'
                ) THEN
                    ALTER TABLE jamin_bookings ADD COLUMN "CancelledByUserId" integer;
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = 'public' AND table_name = 'jamin_bookings' AND column_name = 'CancelledByName'
                ) THEN
                    ALTER TABLE jamin_bookings ADD COLUMN "CancelledByName" character varying(150);
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = 'public' AND table_name = 'jamin_bookings' AND column_name = 'CancellationReason'
                ) THEN
                    ALTER TABLE jamin_bookings ADD COLUMN "CancellationReason" character varying(2000);
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = 'public' AND table_name = 'jamin_bookings' AND column_name = 'RefundAmount'
                ) THEN
                    ALTER TABLE jamin_bookings ADD COLUMN "RefundAmount" numeric(18,2) NOT NULL DEFAULT 0;
                END IF;

                -- Independently guard foreign key constraint for CancelledByUserId
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints 
                    WHERE constraint_schema = 'public' 
                      AND table_name = 'jamin_bookings' 
                      AND constraint_name = 'FK_jamin_bookings_users_CancelledByUserId'
                ) THEN
                    ALTER TABLE jamin_bookings ADD CONSTRAINT "FK_jamin_bookings_users_CancelledByUserId" 
                        FOREIGN KEY ("CancelledByUserId") REFERENCES users ("Id") ON DELETE SET NULL;
                END IF;

                -- 2. Safe partial index creation: verify whether duplicates exist before enforcing UNIQUE
                IF NOT EXISTS (
                    SELECT 1 FROM pg_indexes 
                    WHERE schemaname = 'public' 
                      AND tablename = 'jamin_bookings' 
                      AND indexname = 'IX_jamin_bookings_CompanyId_PlotId_Active'
                ) THEN
                    IF NOT EXISTS (
                        SELECT 1 FROM (
                            SELECT "CompanyId", "PlotId" 
                            FROM jamin_bookings 
                            WHERE "PlotId" IS NOT NULL 
                              AND "Status" IN ('Hold', 'Pending Verification', 'Booking Pending Verification', 'Token Paid', 'Token Verified', 'Agreement Signed', 'Registration Completed')
                            GROUP BY "CompanyId", "PlotId" 
                            HAVING COUNT(*) > 1
                        ) dupes
                    ) THEN
                        CREATE UNIQUE INDEX "IX_jamin_bookings_CompanyId_PlotId_Active" 
                        ON jamin_bookings ("CompanyId", "PlotId") 
                        WHERE "PlotId" IS NOT NULL AND "Status" IN ('Hold', 'Pending Verification', 'Booking Pending Verification', 'Token Paid', 'Token Verified', 'Agreement Signed', 'Registration Completed');
                    ELSE
                        CREATE INDEX "IX_jamin_bookings_CompanyId_PlotId_Active" 
                        ON jamin_bookings ("CompanyId", "PlotId") 
                        WHERE "PlotId" IS NOT NULL AND "Status" IN ('Hold', 'Pending Verification', 'Booking Pending Verification', 'Token Paid', 'Token Verified', 'Agreement Signed', 'Registration Completed');
                        RAISE NOTICE 'Duplicate active bookings detected in existing data. Non-unique index created safely to protect existing records.';
                    END IF;
                END IF;

                -- 3. Create jamin_payments table (with RESTRICT on BookingId to protect financial audit history)
                CREATE TABLE IF NOT EXISTS jamin_payments (
                    "Id" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                    "CompanyId" integer NOT NULL,
                    "BookingId" integer NOT NULL,
                    "CustomerId" integer,
                    "LeadId" integer,
                    "Amount" numeric(18,2) NOT NULL,
                    "PaymentType" character varying(50) NOT NULL DEFAULT 'Token',
                    "PaymentMode" character varying(100) NOT NULL DEFAULT 'Bank Transfer / NEFT',
                    "TransactionReference" character varying(200) NOT NULL DEFAULT '',
                    "Status" character varying(50) NOT NULL DEFAULT 'Pending',
                    "VerifiedAt" timestamp with time zone,
                    "VerifiedByUserId" integer,
                    "VerifiedByName" character varying(150),
                    "ReceiptNumber" character varying(100),
                    "Notes" character varying(2000),
                    "CreatedAt" timestamp with time zone NOT NULL DEFAULT (NOW()),
                    "UpdatedAt" timestamp with time zone,
                    CONSTRAINT "FK_jamin_payments_tenants_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES tenants ("Id") ON DELETE CASCADE,
                    CONSTRAINT "FK_jamin_payments_jamin_bookings_BookingId" FOREIGN KEY ("BookingId") REFERENCES jamin_bookings ("Id") ON DELETE RESTRICT,
                    CONSTRAINT "FK_jamin_payments_customers_CustomerId" FOREIGN KEY ("CustomerId") REFERENCES customers ("Id") ON DELETE SET NULL,
                    CONSTRAINT "FK_jamin_payments_leads_LeadId" FOREIGN KEY ("LeadId") REFERENCES leads ("Id") ON DELETE SET NULL,
                    CONSTRAINT "FK_jamin_payments_users_VerifiedByUserId" FOREIGN KEY ("VerifiedByUserId") REFERENCES users ("Id") ON DELETE SET NULL
                );

                CREATE INDEX IF NOT EXISTS "IX_jamin_payments_BookingId" ON jamin_payments ("BookingId");
                CREATE INDEX IF NOT EXISTS "IX_jamin_payments_CustomerId" ON jamin_payments ("CustomerId");
                CREATE INDEX IF NOT EXISTS "IX_jamin_payments_LeadId" ON jamin_payments ("LeadId");
                CREATE INDEX IF NOT EXISTS "IX_jamin_payments_Status" ON jamin_payments ("Status");
            END $$;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DROP TABLE IF EXISTS jamin_payments;
            DROP INDEX IF EXISTS "IX_jamin_bookings_CompanyId_PlotId_Active";
            ALTER TABLE jamin_bookings DROP CONSTRAINT IF EXISTS "FK_jamin_bookings_users_CancelledByUserId";
            ALTER TABLE jamin_bookings DROP COLUMN IF EXISTS "PaymentStatus";
            ALTER TABLE jamin_bookings DROP COLUMN IF EXISTS "HoldExpiresAt";
            ALTER TABLE jamin_bookings DROP COLUMN IF EXISTS "BasePrice";
            ALTER TABLE jamin_bookings DROP COLUMN IF EXISTS "DevelopmentCharges";
            ALTER TABLE jamin_bookings DROP COLUMN IF EXISTS "ApprovedDiscounts";
            ALTER TABLE jamin_bookings DROP COLUMN IF EXISTS "CancelledAt";
            ALTER TABLE jamin_bookings DROP COLUMN IF EXISTS "CancelledByUserId";
            ALTER TABLE jamin_bookings DROP COLUMN IF EXISTS "CancelledByName";
            ALTER TABLE jamin_bookings DROP COLUMN IF EXISTS "CancellationReason";
            ALTER TABLE jamin_bookings DROP COLUMN IF EXISTS "RefundAmount";
            """);
    }
}
