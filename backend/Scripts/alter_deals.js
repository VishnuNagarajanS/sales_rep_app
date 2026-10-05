const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || process.env.DefaultConnection || 'Host=localhost;Database=neondb'
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
