using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using backend.Data;

#nullable disable

namespace backend.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20260929113000_AddKycVerificationFieldsAndPermissions")]
    public partial class AddKycVerificationFieldsAndPermissions : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotent columns for InvestorKycs
            migrationBuilder.Sql(@"ALTER TABLE ""InvestorKycs"" ADD COLUMN IF NOT EXISTS ""VerifiedBy"" TEXT NULL;");
            migrationBuilder.Sql(@"ALTER TABLE ""InvestorKycs"" ADD COLUMN IF NOT EXISTS ""VerifiedAt"" TIMESTAMP WITH TIME ZONE NULL;");
            migrationBuilder.Sql(@"ALTER TABLE ""InvestorKycs"" ADD COLUMN IF NOT EXISTS ""Remarks"" TEXT NULL;");
            migrationBuilder.Sql(@"ALTER TABLE ""InvestorKycs"" ADD COLUMN IF NOT EXISTS ""FlaggedSectionsJson"" TEXT NULL;");

            // Idempotent columns for GhlDeals (Do NOT duplicate KycStatus)
            migrationBuilder.Sql(@"ALTER TABLE ""GhlDeals"" ADD COLUMN IF NOT EXISTS ""KycId"" INTEGER NULL;");
            migrationBuilder.Sql(@"ALTER TABLE ""GhlDeals"" ADD COLUMN IF NOT EXISTS ""VerifiedBy"" TEXT NULL;");
            migrationBuilder.Sql(@"ALTER TABLE ""GhlDeals"" ADD COLUMN IF NOT EXISTS ""VerifiedAt"" TIMESTAMP WITH TIME ZONE NULL;");
            migrationBuilder.Sql(@"ALTER TABLE ""GhlDeals"" ADD COLUMN IF NOT EXISTS ""Remarks"" TEXT NULL;");
            migrationBuilder.Sql(@"ALTER TABLE ""GhlDeals"" ADD COLUMN IF NOT EXISTS ""FlaggedSections"" TEXT NULL;");

            // Seed kyc.verify to Super Admin (Id 1), Company Admin (Id 2), and IRM (Id 5)
            migrationBuilder.Sql(@"
                UPDATE roles 
                SET ""Permissions"" = array_append(""Permissions"", 'kyc.verify') 
                WHERE ""Id"" IN (1, 2, 5) 
                  AND NOT ('kyc.verify' = ANY(""Permissions""));
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "VerifiedBy", table: "InvestorKycs");
            migrationBuilder.DropColumn(name: "VerifiedAt", table: "InvestorKycs");
            migrationBuilder.DropColumn(name: "Remarks", table: "InvestorKycs");
            migrationBuilder.DropColumn(name: "FlaggedSectionsJson", table: "InvestorKycs");

            migrationBuilder.DropColumn(name: "KycId", table: "GhlDeals");
            migrationBuilder.DropColumn(name: "VerifiedBy", table: "GhlDeals");
            migrationBuilder.DropColumn(name: "VerifiedAt", table: "GhlDeals");
            migrationBuilder.DropColumn(name: "Remarks", table: "GhlDeals");
            migrationBuilder.DropColumn(name: "FlaggedSections", table: "GhlDeals");
        }
    }
}
