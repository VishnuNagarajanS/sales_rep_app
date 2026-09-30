using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations;

[DbContext(typeof(backend.Data.ApplicationDbContext))]
[Migration("20260929130000_AddJaminPropertyInventory")]
public sealed class AddJaminPropertyInventory : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "jamin_projects",
            columns: table => new
            {
                Id = table.Column<int>(type: "integer", nullable: false).Annotation("Npgsql:ValueGenerationStrategy", Npgsql.EntityFrameworkCore.PostgreSQL.Metadata.NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                CompanyId = table.Column<int>(type: "integer", nullable: false),
                Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                Location = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                Status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false, defaultValue: "Active"),
                Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                TotalPlots = table.Column<int>(type: "integer", nullable: false),
                AvailablePlots = table.Column<int>(type: "integer", nullable: false),
                BookedPlots = table.Column<int>(type: "integer", nullable: false),
                PriceRange = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                ImageUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_jamin_projects", x => x.Id);
                table.ForeignKey("FK_jamin_projects_tenants_CompanyId", x => x.CompanyId, "tenants", "Id", onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "jamin_plots",
            columns: table => new
            {
                Id = table.Column<int>(type: "integer", nullable: false).Annotation("Npgsql:ValueGenerationStrategy", Npgsql.EntityFrameworkCore.PostgreSQL.Metadata.NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                CompanyId = table.Column<int>(type: "integer", nullable: false),
                ProjectId = table.Column<int>(type: "integer", nullable: false),
                PlotNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                Dimensions = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                AreaSqFt = table.Column<int>(type: "integer", nullable: false),
                Facing = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                Status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false, defaultValue: "Available"),
                Price = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                HeldByCustomerName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                HeldByCustomerPhone = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                HoldExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_jamin_plots", x => x.Id);
                table.ForeignKey("FK_jamin_plots_tenants_CompanyId", x => x.CompanyId, "tenants", "Id", onDelete: ReferentialAction.Cascade);
                table.ForeignKey("FK_jamin_plots_jamin_projects_ProjectId", x => x.ProjectId, "jamin_projects", "Id", onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "jamin_bookings",
            columns: table => new
            {
                Id = table.Column<int>(type: "integer", nullable: false).Annotation("Npgsql:ValueGenerationStrategy", Npgsql.EntityFrameworkCore.PostgreSQL.Metadata.NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                CompanyId = table.Column<int>(type: "integer", nullable: false),
                ProjectId = table.Column<int>(type: "integer", nullable: true),
                PlotId = table.Column<int>(type: "integer", nullable: true),
                CustomerName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                CustomerPhone = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                ProjectName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                PlotNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                TotalPlotPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                TokenAmountPaid = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                PaymentMode = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                Status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false, defaultValue: "Token Paid"),
                BookingDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                AssignedAgentId = table.Column<int>(type: "integer", nullable: true),
                AssignedAgentName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_jamin_bookings", x => x.Id);
                table.ForeignKey("FK_jamin_bookings_tenants_CompanyId", x => x.CompanyId, "tenants", "Id", onDelete: ReferentialAction.Cascade);
                table.ForeignKey("FK_jamin_bookings_jamin_projects_ProjectId", x => x.ProjectId, "jamin_projects", "Id", onDelete: ReferentialAction.SetNull);
                table.ForeignKey("FK_jamin_bookings_jamin_plots_PlotId", x => x.PlotId, "jamin_plots", "Id", onDelete: ReferentialAction.SetNull);
                table.ForeignKey("FK_jamin_bookings_users_AssignedAgentId", x => x.AssignedAgentId, "users", "Id", onDelete: ReferentialAction.SetNull);
            });

        migrationBuilder.CreateIndex("IX_jamin_projects_CompanyId_Status", "jamin_projects", new[] { "CompanyId", "Status" });
        migrationBuilder.CreateIndex("IX_jamin_plots_CompanyId_ProjectId_Status", "jamin_plots", new[] { "CompanyId", "ProjectId", "Status" });
        migrationBuilder.CreateIndex("IX_jamin_plots_ProjectId_PlotNumber", "jamin_plots", new[] { "ProjectId", "PlotNumber" }, unique: true);
        migrationBuilder.CreateIndex("IX_jamin_bookings_CompanyId_Status", "jamin_bookings", new[] { "CompanyId", "Status" });
        migrationBuilder.CreateIndex("IX_jamin_bookings_CustomerPhone", "jamin_bookings", "CustomerPhone");
        migrationBuilder.CreateIndex("IX_jamin_bookings_ProjectId", "jamin_bookings", "ProjectId");
        migrationBuilder.CreateIndex("IX_jamin_bookings_PlotId", "jamin_bookings", "PlotId");
        migrationBuilder.CreateIndex("IX_jamin_bookings_AssignedAgentId", "jamin_bookings", "AssignedAgentId");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "jamin_bookings");
        migrationBuilder.DropTable(name: "jamin_plots");
        migrationBuilder.DropTable(name: "jamin_projects");
    }
}
