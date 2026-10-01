
$bin = 'C:\Users\ADMIN\Desktop\sales_rep_app\backend\bin\Debug\net8.0'
[System.Reflection.Assembly]::LoadFrom("$bin\Npgsql.dll") | Out-Null
$cs = 'Host=ep-sparkling-leaf-b3evey2y.c-4.ap-southeast-1.aws.neon.tech;Port=5432;Database=neondb;Username=neondb_owner;Password=npg_wIWrXLJV9fF3;SSL Mode=Require;Trust Server Certificate=true'
$conn = [Npgsql.NpgsqlConnection]::new($cs)
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = 'DROP TABLE IF EXISTS "InvestorKycs" CASCADE;'
$cmd.ExecuteNonQuery()
$conn.Close()
Write-Output 'Dropped table'

