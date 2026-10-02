using System;
using Npgsql;

class Program {
    static void Main() {
        var connStr = ""Host=ep-sparkling-leaf-b3evey2y.c-4.ap-southeast-1.aws.neon.tech;Port=5432;Database=neondb;Username=neondb_owner;Password=npg_wIWrXLJV9fF3;SSL Mode=Require;Trust Server Certificate=true"";
        using var conn = new NpgsqlConnection(connStr);
        conn.Open();

        using var cmd = new NpgsqlCommand(""SELECT u."Name", r."Name", r."Code", u."RoleId" FROM users u JOIN roles r ON u."RoleId" = r."Id" WHERE u."Name" = 'Test_Sales'"", conn);
        using var reader = cmd.ExecuteReader();
        while (reader.Read()) {
            Console.WriteLine($""User: {reader.GetString(0)}, Role: {reader.GetString(1)}, Code: {reader.GetString(2)}, RoleId: {reader.GetInt32(3)}"");
        }
    }
}
