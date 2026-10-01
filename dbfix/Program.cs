using System;
using Npgsql;

class Program {
    static void Main() {
        var connStr = "Host=ep-sparkling-leaf-b3evey2y.c-4.ap-southeast-1.aws.neon.tech;Port=5432;Database=neondb;Username=neondb_owner;Password=npg_wIWrXLJV9fF3;SSL Mode=Require;Trust Server Certificate=true";
        using var conn = new NpgsqlConnection(connStr);
        conn.Open();

        // Fix Sales Executives (Role 3)
        var cmd1 = new NpgsqlCommand("UPDATE users SET \"RoleId\" = 3 WHERE \"Name\" IN ('Naveen', 'Test_Sales', 'Test_sales_2', 'mani1')", conn);
        var r1 = cmd1.ExecuteNonQuery();
        Console.WriteLine($"Fixed {r1} Sales Executives.");

        // Fix IRMs (Role 4)
        var cmd2 = new NpgsqlCommand("UPDATE users SET \"RoleId\" = 4 WHERE \"Name\" IN ('Dhinakaran', 'Test_IRM')", conn);
        var r2 = cmd2.ExecuteNonQuery();
        Console.WriteLine($"Fixed {r2} IRMs.");

        using var cmd3 = new NpgsqlCommand("SELECT \"Name\", \"RoleId\" FROM users", conn);
        using var reader = cmd3.ExecuteReader();
        while (reader.Read()) {
            Console.WriteLine($"User: {reader.GetString(0)}, RoleId: {reader.GetInt32(1)}");
        }
    }
}
