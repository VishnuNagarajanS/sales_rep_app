const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgres://neondb_owner:npg_wIWrXLJV9fF3@ep-sparkling-leaf-b3evey2y.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
  });

  await client.connect();
  console.log('Connected to Neon PostgreSQL.');

  await client.query('ALTER TABLE "GhlDeals" ALTER COLUMN "CustomerId" DROP NOT NULL;');
  console.log('Successfully dropped NOT NULL on "GhlDeals"."CustomerId"');

  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
