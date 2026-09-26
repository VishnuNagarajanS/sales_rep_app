const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_wIWrXLJV9fF3@ep-sparkling-leaf-b3evey2y.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
});
client.connect().then(async () => {
  const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;");
  console.log('Tables in DB:');
  res.rows.forEach(r => console.log(' - ' + r.table_name));
  await client.end();
}).catch(e => console.error(e));
