
$bin = 'C:\Users\ADMIN\Desktop\sales_rep_app\backend\bin\Debug\net8.0'
[System.Reflection.Assembly]::LoadFrom("$bin\Npgsql.dll") | Out-Null
$cs = $env:ConnectionStrings__DefaultConnection
if (-not $cs) { throw "ConnectionStrings__DefaultConnection environment variable is missing" }
$conn = [Npgsql.NpgsqlConnection]::new($cs)
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = 'DROP TABLE IF EXISTS "InvestorKycs" CASCADE;'
$cmd.ExecuteNonQuery()
$conn.Close()
Write-Output 'Dropped table'

