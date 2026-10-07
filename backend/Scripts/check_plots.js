const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgres://neondb_owner:npg_wIWrXLJV9fF3@ep-sparkling-leaf-b3evey2y.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
  });

  await client.connect();
  const res = await client.query('SELECT "Id", "PlotNumber", "Status", "Notes", "HeldByCustomerName", "HoldByAgent" FROM jamin_plots;');
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
}

main().catch(console.error);
