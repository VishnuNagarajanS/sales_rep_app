using System;
using Npgsql;

class Program {
    static void Main() {
        var connStr = ""Host=ep-sparkling-leaf-b3evey2y.c-4.ap-southeast-1.aws.neon.tech;Database=neondb;Username=neondb_owner;Password=rS9xJbX5mQvK;SslMode=Require"";
        using var conn = new NpgsqlConnection(connStr);
        conn.Open();
        using var cmd = new NpgsqlCommand(""SELECT ""Id"", ""Name"", ""RoleId"" FROM users WHERE ""Name"" = 'Test_Sales'"", conn);
        using var reader = cmd.ExecuteReader();
        while (reader.Read()) {
            Console.WriteLine($""User: {reader.GetString(1)}, RoleId: {reader.GetInt32(2)}, Id: {reader.GetInt32(0)}"");
        }
    }
}
