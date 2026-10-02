const { Client } = require('pg');
const client = new Client({
  connectionString: process.env.DATABASE_URL || process.env.DefaultConnection || 'Host=localhost;Database=neondb'
});
client.connect().then(async () => {
  const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;");
  console.log('Tables in DB:');
  res.rows.forEach(r => console.log(' - ' + r.table_name));
  await client.end();
}).catch(e => console.error(e));
