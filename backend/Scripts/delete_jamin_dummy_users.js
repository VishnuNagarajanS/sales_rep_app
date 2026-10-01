const { Client } = require('C:/Users/LENOVO/Desktop/New folder/frontend/node_modules/pg');

async function main() {
  const client = new Client({
    connectionString: 'postgres://neondb_owner:npg_wIWrXLJV9fF3@ep-sparkling-leaf-b3evey2y.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
  });

  await client.connect();
  console.log('Connected to Neon DB.');

  // Delete all dummy users with @jaminbazaar.com or @jaminbazar.com
  const res = await client.query(`
    DELETE FROM users 
    WHERE "Email" LIKE '%@jaminbazaar.com%' 
       OR "Email" LIKE '%@jaminbazar.com%' 
    RETURNING "Id", "Name", "Email";
  `);

  console.log('Deleted dummy users:', res.rows);
  await client.end();
}

main().catch(err => {
  console.error('Error deleting dummy users:', err);
  process.exit(1);
});
