using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class DisableDemoUsers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Note: ASPNETCORE_ENVIRONMENT is checked at *migration* time, not at runtime.
            // If you run `dotnet ef database update` from a terminal without ASPNETCORE_ENVIRONMENT set, 
            // this variable will be null, and it will run the SQL to disable these users even on a local DB.
            var isDev = System.Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") == "Development";
            if (!isDev)
            {
                migrationBuilder.Sql(@"
UPDATE users 
SET ""Status"" = 'Inactive', ""PasswordHash"" = 'DISABLED' 
WHERE ""Email"" IN (
    'priya@ghlindiaventures.com', /* DECISION NEEDED: confirm priya@... is a demo account */
    'agent1@example.com',
    'agent2@example.com'
);");
            }
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Cannot reliably restore the passwords and statuses, so leave empty
        }
    }
}
