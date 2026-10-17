using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class DropLeadCustomFieldsJson : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("ALTER TABLE leads DROP COLUMN IF EXISTS \"CustomFieldsJson\";");
            migrationBuilder.Sql("ALTER TABLE leads DROP COLUMN IF EXISTS \"custom_fields_json\";");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CustomFieldsJson",
                table: "leads",
                type: "text",
                nullable: true);
        }
    }
}
